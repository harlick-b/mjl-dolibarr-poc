<?php

/**
 * Shared invariant for finance updates whose audit history requires a
 * human-entered reason.
 */
trait MjlFinanceGovernedUpdateComment
{
	protected function normalizeRequiredUpdateComment(&$comment)
	{
		$comment = trim((string) $comment);
		if ($comment !== '') {
			return true;
		}
		$this->error = 'Update comment is required';
		return false;
	}
}
