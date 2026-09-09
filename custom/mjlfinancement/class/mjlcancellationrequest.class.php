<?php

/** Closed cancellation request vocabulary. Mutations belong to MjlActivityCommand. */
class MjlCancellationRequest
{
	const TARGET_ACTIVITY = 'ACTIVITY';
	const TARGET_OPERATION = 'OPERATION';
	const PENDING = 'PENDING';
	const APPROVED = 'APPROVED';
	const REJECTED = 'REJECTED';
	const WITHDRAWN = 'WITHDRAWN';
}

