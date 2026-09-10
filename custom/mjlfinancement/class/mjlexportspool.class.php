<?php

/** One fixed lock owns generation and orphan cleanup; only the final descriptor leaves this owner. */
class MjlExportSpool
{
	private $root;
	private $lock;
	private $attempt;

	public function __construct($root)
	{
		$this->root=rtrim($root,'/');
		if ($this->root==='' || $this->root[0]!=='/') throw new RuntimeException('INVALID_SPOOL');
		if (!file_exists($this->root) && !is_link($this->root) && !mkdir($this->root,0700)) throw new RuntimeException('SPOOL_UNAVAILABLE');
		$this->requirePrivate($this->root,true);
		$path=$this->root.'/generation.lock';
		$fd=@fopen($path,'x+b');
		if ($fd!==false) chmod($path,0600);
		else { $this->requirePrivate($path,false); $fd=@fopen($path,'r+b'); }
		if ($fd===false) throw new RuntimeException('SPOOL_UNAVAILABLE');
		$stat=fstat($fd); $named=lstat($path);
		if (!$stat || !$named || $stat['ino']!==$named['ino'] || $stat['dev']!==$named['dev'] || ($stat['mode']&0170000)!==0100000) { fclose($fd); throw new RuntimeException('INVALID_SPOOL'); }
		if (!flock($fd,LOCK_EX|LOCK_NB)) { fclose($fd); throw new RuntimeException('EXPORT_BUSY'); }
		$this->lock=$fd;
		try { $this->sweep(); } catch (Throwable $e) { $this->close(); throw $e; }
	}

	private function requirePrivate($path,$directory)
	{
		$stat=lstat($path);
		if (!$stat || is_link($path) || ($stat['mode']&0170000)!==($directory?0040000:0100000) || ($stat['mode']&07777)!==($directory?0700:0600) || $stat['uid']!==posix_geteuid()) throw new RuntimeException('INVALID_SPOOL');
	}

	private function removeAttempt($path)
	{
		$this->requirePrivate($path,true);
		$entries=scandir($path);
		if ($entries===false) throw new RuntimeException('SPOOL_UNAVAILABLE');
		foreach ($entries as $name) {
			if ($name==='.' || $name==='..') continue;
			// Native ZIP writers may leave temporary siblings on a crash.
			// Only private regular files inside this recognized attempt are removable.
			$this->requirePrivate($path.'/'.$name,false);
			if (!unlink($path.'/'.$name)) throw new RuntimeException('SPOOL_CLEANUP_FAILED');
		}
		if (!rmdir($path)) throw new RuntimeException('SPOOL_CLEANUP_FAILED');
	}

	private function sweep()
	{
		$entries=scandir($this->root);
		if ($entries===false) throw new RuntimeException('SPOOL_UNAVAILABLE');
		foreach ($entries as $name) if (preg_match('/^attempt-[0-9a-f]{32}$/D',$name)) $this->removeAttempt($this->root.'/'.$name);
	}

	public function create($format)
	{
		if (!is_resource($this->lock) || $this->attempt!==null || !in_array($format,array('pdf','xlsx','csv'),true)) throw new RuntimeException('INVALID_SPOOL_STATE');
		$this->attempt=$this->root.'/attempt-'.bin2hex(random_bytes(16));
		if (!mkdir($this->attempt,0700)) { $this->attempt=null; throw new RuntimeException('SPOOL_UNAVAILABLE'); }
		$path=$this->attempt.'/artifact.'.$format;
		$fd=fopen($path,'x+b');
		if ($fd===false) throw new RuntimeException('SPOOL_UNAVAILABLE');
		try { if (!chmod($path,0600)) throw new RuntimeException('SPOOL_UNAVAILABLE'); } finally { fclose($fd); }
		return $path;
	}

	/** Hash, rewind and unlink the exact regular descriptor before authorization commit. */
	public function detach($path)
	{
		if (!$this->attempt || dirname($path)!==$this->attempt) throw new RuntimeException('INVALID_SPOOL_STATE');
		$this->requirePrivate($path,false);
		$fd=fopen($path,'rb');
		if ($fd===false) throw new RuntimeException('SPOOL_UNAVAILABLE');
		try {
			$stat=fstat($fd); $named=lstat($path);
			if (!$stat || !$named || $stat['ino']!==$named['ino'] || $stat['dev']!==$named['dev'] || ($stat['mode']&0170000)!==0100000 || $stat['size']<1 || $stat['size']>20971520) throw new RuntimeException('ARTIFACT_LIMIT');
			$hash=hash_init('sha256');
			if (hash_update_stream($hash,$fd)!==$stat['size'] || !rewind($fd)) throw new RuntimeException('ARTIFACT_READ_FAILED');
			$digest=hash_final($hash);
			if (!unlink($path)) throw new RuntimeException('SPOOL_CLEANUP_FAILED');
			return array('stream'=>$fd,'bytes'=>$stat['size'],'sha256'=>$digest);
		} catch (Throwable $e) { fclose($fd); throw $e; }
	}

	public function close()
	{
		try { if ($this->attempt!==null) { $this->removeAttempt($this->attempt); $this->attempt=null; } }
		finally { if (is_resource($this->lock)) { flock($this->lock,LOCK_UN); fclose($this->lock); $this->lock=null; } }
	}
}
