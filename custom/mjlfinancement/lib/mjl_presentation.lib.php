<?php

/**
 * Shared display-only formatting and internal-link policy.
 *
 * Every formatter returns plain text. HTML callers must escape the result.
 */

function mjl_presentation_numeric_value($value)
{
	if ($value === null || $value === '' || is_bool($value) || !is_numeric($value)) return null;
	$number = (float) $value;
	return is_finite($number) ? $number : null;
}

function mjl_format_number($value, $kind = 'decimal', $precision = null, $emptyLabel = 'Non renseigné')
{
	$number = mjl_presentation_numeric_value($value);
	if ($number === null) return (string) $emptyLabel;

	$kind = (string) $kind;
	$defaults = array('count' => 0, 'percentage' => 1, 'decimal' => 2);
	if (!isset($defaults[$kind])) $kind = 'decimal';
	$precision = $precision === null ? $defaults[$kind] : max(0, min(8, (int) $precision));
	$rounded = round($number, $precision);
	if ($rounded == 0.0) $rounded = 0.0;
	$formatted = number_format($rounded, $precision, ',', ' ');
	return $kind === 'percentage' ? $formatted.' %' : $formatted;
}

function mjl_format_money($value, $currency = 'XOF', $emptyLabel = 'Non renseigné')
{
	$currency = strtoupper(trim((string) $currency));
	if (!preg_match('/^[A-Z]{3}$/', $currency)) return (string) $emptyLabel;
	$label = $currency === 'XOF' ? 'F CFA' : $currency;
	$text = is_int($value) || is_string($value) ? (string) $value : '';
	if (preg_match('/^-?(?:0|[1-9][0-9]*)$/', $text)) {
		$negative = $text[0] === '-';
		$digits = $negative ? substr($text, 1) : $text;
		return ($negative && $digits !== '0' ? '-' : '').preg_replace('/\B(?=(?:\d{3})+(?!\d))/', ' ', $digits).' '.$label;
	}
	$number = mjl_presentation_numeric_value($value);
	if ($number === null) return (string) $emptyLabel;
	return mjl_format_number($number, 'count', 0, $emptyLabel).' '.$label;
}

function mjl_format_date($value, $style = 'date', $emptyLabel = 'Non renseigné')
{
	if ($value === null || $value === '') return (string) $emptyLabel;
	$style = (string) $style;
	$formats = array('date' => 'd/m/Y', 'datetime' => 'd/m/Y H:i', 'time' => 'H:i');
	if (!isset($formats[$style])) $style = 'date';
	try {
		$targetTimezone = mjl_presentation_user_timezone();
		if ($value instanceof DateTimeInterface) {
			$date = (new DateTimeImmutable('@'.$value->getTimestamp()))->setTimezone($targetTimezone);
		} elseif (is_int($value) || (is_string($value) && preg_match('/^-?\d+$/', $value))) {
			$date = (new DateTimeImmutable('@'.((int) $value)))->setTimezone($targetTimezone);
		} else {
			$text = trim((string) $value);
			if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $text, $matches)) {
				if (!checkdate((int) $matches[2], (int) $matches[3], (int) $matches[1])) return (string) $emptyLabel;
				$date = DateTimeImmutable::createFromFormat('!Y-m-d', $text, new DateTimeZone('UTC'));
			} elseif (preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/', $text)) {
				$serverTimezone = mjl_presentation_timezone(date_default_timezone_get());
				if ($serverTimezone === null) return (string) $emptyLabel;
				$normalized = str_replace('T', ' ', $text);
				$inputFormat = strlen($normalized) === 16 ? '!Y-m-d H:i' : '!Y-m-d H:i:s';
				$date = DateTimeImmutable::createFromFormat($inputFormat, $normalized, $serverTimezone);
				if (!mjl_presentation_date_parse_succeeded($date)) return (string) $emptyLabel;
				$date = $date->setTimezone($targetTimezone);
			} elseif (preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2}|Z)$/', $text)) {
				$date = new DateTimeImmutable($text);
				if (!mjl_presentation_date_parse_succeeded($date)) return (string) $emptyLabel;
				$date = $date->setTimezone($targetTimezone);
			} else {
				return (string) $emptyLabel;
			}
		}
	} catch (Exception $exception) {
		return (string) $emptyLabel;
	}
	return $date->format($formats[$style]);
}

function mjl_presentation_timezone($identifier)
{
	$identifier = trim((string) $identifier);
	if ($identifier === '') return null;
	try { return new DateTimeZone($identifier); } catch (Exception $exception) { return null; }
}

function mjl_presentation_user_timezone()
{
	if (isset($_SESSION['dol_tz_string']) && trim((string) $_SESSION['dol_tz_string']) !== '') {
		return mjl_presentation_timezone($_SESSION['dol_tz_string']) ?: new DateTimeZone('UTC');
	}
	$configured = function_exists('getDolGlobalString') ? getDolGlobalString('MAIN_DOLIBARR_USER_TIMEZONE') : '';
	if (trim((string) $configured) !== '') return mjl_presentation_timezone($configured) ?: new DateTimeZone('UTC');
	return new DateTimeZone('UTC');
}

function mjl_presentation_date_parse_succeeded($date)
{
	if (!$date instanceof DateTimeInterface) return false;
	$errors = DateTimeImmutable::getLastErrors();
	return $errors === false || ((int) $errors['warning_count'] === 0 && (int) $errors['error_count'] === 0);
}

function mjl_safe_internal_path($value)
{
	$value = trim((string) $value);
	if ($value === '' || strlen($value) > 2048 || preg_match('/%(?![0-9A-Fa-f]{2})/', $value)) return '';
	$decoded = $value;
	for ($pass = 0; $pass <= 16; $pass++) {
		if (!mjl_internal_path_layer_is_safe($decoded)) return '';
		$next = rawurldecode($decoded);
		if ($next === $decoded) return $value;
		if ($pass === 16) return '';
		$decoded = $next;
	}
	return '';
}

function mjl_internal_path_layer_is_safe($value)
{
	if ($value === '' || $value[0] !== '/' || strpos($value, '//') === 0) return false;
	if (preg_match('/[\x00-\x1F\x7F]/', $value) || strpos($value, '\\') !== false) return false;
	if (preg_match('/^[a-z][a-z0-9+.-]*:/i', ltrim($value, '/'))) return false;
	$parts = parse_url($value);
	if ($parts === false || isset($parts['scheme']) || isset($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) return false;
	$path = isset($parts['path']) ? (string) $parts['path'] : '';
	return $path !== '' && !preg_match('#(?:^|/)\.\.?(/|$)#', $path);
}

function mjl_public_url_for_internal_path($path, $trustedOrigin = '')
{
	$path = mjl_safe_internal_path($path);
	if ($path === '') return '';
	$origin = rtrim(trim((string) $trustedOrigin), '/');
	if ($origin === '') return '';
	$parts = parse_url($origin);
	if ($parts === false || !in_array(strtolower((string) ($parts['scheme'] ?? '')), array('http', 'https'), true) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) return '';
	return $origin.$path;
}
