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
		$comment = html_entity_decode($comment, ENT_QUOTES | ENT_HTML5, 'UTF-8');
		$comment = html_entity_decode($comment, ENT_QUOTES | ENT_HTML5, 'UTF-8');
		$comment = preg_replace('/[\s\x{00A0}]+/u', ' ', $comment);
		$comment = trim((string) $comment);
		if ($comment !== '') {
			return true;
		}
		$this->error = 'Update comment is required';
		return false;
	}
}
