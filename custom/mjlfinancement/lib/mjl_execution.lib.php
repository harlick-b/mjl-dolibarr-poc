<?php

/** Pure Phase 3A execution projections. No database or ambient-time access. */

function mjl_execution_porto_novo_date($instant)
{
	if ($instant instanceof DateTimeInterface) $instant = new DateTimeImmutable('@'.$instant->getTimestamp());
	else $instant = new DateTimeImmutable((string) $instant, new DateTimeZone('UTC'));
	return $instant->setTimezone(new DateTimeZone('Africa/Porto-Novo'))->format('Y-m-d');
}

function mjl_execution_project_status(array $activity, array $operations, $localDate)
{
	if (!isset($activity['latest_validated_amount']) || $activity['latest_validated_amount'] === null) return 'NOT_STARTED';
	if (!empty($activity['is_cancelled'])) return 'CANCELLED';
	$allCancelled = count($operations) > 0;
	$allTerminal = count($operations) > 0;
	$hasCompleted = false;
	foreach ($operations as $operation) {
		$status = isset($operation['status']) ? (string) $operation['status'] : '';
		if ($status !== 'CANCELLED') $allCancelled = false;
		if (!in_array($status, array('COMPLETED', 'CANCELLED'), true)) $allTerminal = false;
		if ($status === 'COMPLETED') $hasCompleted = true;
	}
	if ($allCancelled) return 'CANCELLED';
	if ($allTerminal && $hasCompleted) return 'COMPLETED';
	if ((string) $localDate > (string) $activity['date_end']) return 'OVERDUE';
	if ((string) $localDate < (string) $activity['date_start']) return 'UPCOMING';
	return 'IN_PROGRESS';
}

function mjl_execution_summarize(array $operations)
{
	$activeAuthorized = '0';
	$cancelledAuthorized = '0';
	$activeSpent = null;
	$cancelledSpent = null;
	$explicit = 0;
	$missing = 0;
	$cancelledIncomplete = 0;
	foreach ($operations as $operation) {
		$cancelled = isset($operation['status']) && $operation['status'] === 'CANCELLED';
		$authorized = mjl_execution_unsigned_decimal(isset($operation['authorized_amount']) ? $operation['authorized_amount'] : '0');
		if ($cancelled) $cancelledAuthorized = mjl_execution_decimal_add($cancelledAuthorized, $authorized);
		else $activeAuthorized = mjl_execution_decimal_add($activeAuthorized, $authorized);
		if (!array_key_exists('spent_amount', $operation) || $operation['spent_amount'] === null) {
			$missing++;
			if ($cancelled) $cancelledIncomplete++;
			continue;
		}
		$spent = mjl_execution_unsigned_decimal($operation['spent_amount']);
		$explicit++;
		if ($cancelled) $cancelledSpent = mjl_execution_decimal_add($cancelledSpent === null ? '0' : $cancelledSpent, $spent);
		else $activeSpent = mjl_execution_decimal_add($activeSpent === null ? '0' : $activeSpent, $spent);
	}
	$count = count($operations);
	$completeness = $explicit === 0 ? 'NOT_STARTED' : ($explicit === $count ? 'COMPLETE' : 'PARTIAL');
	$totalSpent = $activeSpent === null && $cancelledSpent === null ? null : mjl_execution_decimal_add($activeSpent === null ? '0' : $activeSpent, $cancelledSpent === null ? '0' : $cancelledSpent);
	return array(
		'completeness' => $completeness,
		'explicit_spent_count' => $explicit,
		'missing_spent_count' => $missing,
		'cancelled_incomplete_count' => $cancelledIncomplete,
		'active_authorized_amount' => $activeAuthorized,
		'cancelled_authorized_amount' => $cancelledAuthorized,
		'active_spent_amount' => $activeSpent,
		'cancelled_spent_amount' => $cancelledSpent,
		'total_spent_amount' => $totalSpent,
	);
}

function mjl_execution_variance_percent($spent, $authorized)
{
	if ($spent === null) return 'Non renseigné';
	$spent = mjl_execution_unsigned_decimal($spent);
	$authorized = mjl_execution_unsigned_decimal($authorized);
	if ($authorized === '0') return 'Non renseigné';
	$comparison = mjl_execution_decimal_compare($spent, $authorized);
	if ($comparison === 0) return '-';
	$delta = $comparison > 0 ? mjl_execution_decimal_subtract($spent, $authorized) : mjl_execution_decimal_subtract($authorized, $spent);
	list($hundredths, $remainder) = mjl_execution_decimal_divmod($delta.'0000', $authorized);
	if (mjl_execution_decimal_compare(mjl_execution_decimal_add($remainder, $remainder), $authorized) >= 0) $hundredths = mjl_execution_decimal_add($hundredths, '1');
	$hundredths = str_pad($hundredths, 3, '0', STR_PAD_LEFT);
	$whole = substr($hundredths, 0, -2);
	$fraction = substr($hundredths, -2);
	return ($comparison > 0 ? '+' : '-').$whole.','.$fraction.' %';
}

function mjl_execution_variance_amount($spent, $authorized)
{
	if ($spent === null) return 'Non renseigné';
	$spent = mjl_execution_unsigned_decimal($spent);
	$authorized = mjl_execution_unsigned_decimal($authorized);
	$comparison = mjl_execution_decimal_compare($spent, $authorized);
	if ($comparison === 0) return '-';
	$difference = $comparison > 0
		? mjl_execution_decimal_subtract($spent, $authorized)
		: mjl_execution_decimal_subtract($authorized, $spent);
	return ($comparison > 0 ? '+' : '-').mjl_format_money($difference);
}

function mjl_execution_unsigned_decimal($value)
{
	$value = (string) $value;
	if (!preg_match('/^(?:0|[1-9][0-9]*)$/', $value)) return '0';
	return ltrim($value, '0') === '' ? '0' : ltrim($value, '0');
}

function mjl_execution_decimal_compare($left, $right)
{
	$left = mjl_execution_unsigned_decimal($left);
	$right = mjl_execution_unsigned_decimal($right);
	if (strlen($left) !== strlen($right)) return strlen($left) < strlen($right) ? -1 : 1;
	return $left === $right ? 0 : ($left < $right ? -1 : 1);
}

function mjl_execution_decimal_add($left, $right)
{
	$left = strrev(mjl_execution_unsigned_decimal($left));
	$right = strrev(mjl_execution_unsigned_decimal($right));
	$length = max(strlen($left), strlen($right));
	$carry = 0;
	$result = '';
	for ($index = 0; $index < $length; $index++) {
		$sum = ($index < strlen($left) ? (int) $left[$index] : 0) + ($index < strlen($right) ? (int) $right[$index] : 0) + $carry;
		$result .= (string) ($sum % 10);
		$carry = intdiv($sum, 10);
	}
	if ($carry) $result .= (string) $carry;
	return strrev($result);
}

function mjl_execution_decimal_subtract($larger, $smaller)
{
	$larger = strrev(mjl_execution_unsigned_decimal($larger));
	$smaller = strrev(mjl_execution_unsigned_decimal($smaller));
	$borrow = 0;
	$result = '';
	for ($index = 0; $index < strlen($larger); $index++) {
		$digit = (int) $larger[$index] - $borrow - ($index < strlen($smaller) ? (int) $smaller[$index] : 0);
		if ($digit < 0) { $digit += 10; $borrow = 1; } else $borrow = 0;
		$result .= (string) $digit;
	}
	$result = ltrim(strrev($result), '0');
	return $result === '' ? '0' : $result;
}

function mjl_execution_decimal_divmod($dividend, $divisor)
{
	$dividend = mjl_execution_unsigned_decimal($dividend);
	$divisor = mjl_execution_unsigned_decimal($divisor);
	$quotient = '';
	$remainder = '0';
	for ($index = 0; $index < strlen($dividend); $index++) {
		$remainder = mjl_execution_unsigned_decimal(($remainder === '0' ? '' : $remainder).$dividend[$index]);
		$digit = 0;
		while (mjl_execution_decimal_compare($remainder, $divisor) >= 0) {
			$remainder = mjl_execution_decimal_subtract($remainder, $divisor);
			$digit++;
		}
		$quotient .= (string) $digit;
	}
	$quotient = ltrim($quotient, '0');
	return array($quotient === '' ? '0' : $quotient, $remainder);
}
