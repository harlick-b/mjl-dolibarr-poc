<?php

function mjl_resolve_verification_module($root, array $relativePaths, $requestedPath)
{
	$root = realpath($root);
	if ($root === false || !is_dir($root)) {
		fwrite(STDERR, 'Verification root is unavailable.'.PHP_EOL);
		return false;
	}

	if (!is_string($requestedPath) || !in_array($requestedPath, $relativePaths, true)) {
		fwrite(STDERR, 'A valid allowlisted verification module is required.'.PHP_EOL);
		return false;
	}

	$path = realpath($root.DIRECTORY_SEPARATOR.$requestedPath);
	if ($path === false || strpos($path, $root.DIRECTORY_SEPARATOR) !== 0 || !is_file($path)) {
		fwrite(STDERR, 'Invalid verification module: '.$requestedPath.PHP_EOL);
		return false;
	}

	return $path;
}
