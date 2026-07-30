<?php

/**
 * Shared invariant for finance updates whose audit history requires a
 * human-entered reason.
 */
trait MjlFinanceGovernedUpdateComment
{
	protected function normalizeRequiredUpdateComment(&$comment)
	{
		$comment = strip_tags((string) $comment);
		$stable = false;
		for ($pass = 0; $pass < 10; $pass++) {
			$decoded = html_entity_decode($comment, ENT_QUOTES | ENT_HTML5, 'UTF-8');
			if ($decoded === $comment) {
				$stable = true;
				break;
			}
			$comment = $decoded;
		}
		if (!$stable) {
			$this->error = 'Update comment is required';
			return false;
		}
		$comment = preg_replace('/[\s\p{Z}\p{Cf}]+/u', ' ', $comment);
		if ($comment === null) {
			$this->error = 'Update comment is required';
			return false;
		}
		$comment = trim((string) $comment);
		if ($comment !== '') {
			return true;
		}
		$this->error = 'Update comment is required';
		return false;
	}
}
