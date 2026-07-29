<?php

/**
 * Pure partial-result aggregation for timelines and other component loaders.
 */
function mjl_timeline_aggregate_sources($sources, $ascending = true)
{
	$items = array();
	$errors = array();
	foreach ((array) $sources as $sourceIndex => $envelope) {
		$source = isset($envelope['source']) ? (string) $envelope['source'] : 'source_'.$sourceIndex;
		$sourceOrder = isset($envelope['order']) ? (int) $envelope['order'] : (int) $sourceIndex;
		foreach ((array) ($envelope['items'] ?? array()) as $itemIndex => $item) {
			$item['_source'] = $source;
			$item['_source_order'] = $sourceOrder;
			$item['_row_order'] = isset($item['rowid']) ? (int) $item['rowid'] : (int) $itemIndex;
			$items[] = $item;
		}
		foreach ((array) ($envelope['errors'] ?? array()) as $error) {
			$errors[] = array('source' => $source, 'category' => (string) $error);
		}
	}
	usort($items, function ($left, $right) use ($ascending) {
		$comparison = strcmp((string) ($left['sort_date'] ?? ''), (string) ($right['sort_date'] ?? ''));
		if ($comparison === 0) {
			$comparison = ((int) $left['_source_order']) - ((int) $right['_source_order']);
		}
		if ($comparison === 0) {
			$comparison = ((int) $left['_row_order']) - ((int) $right['_row_order']);
		}
		return $ascending ? $comparison : -$comparison;
	});
	foreach ($items as &$item) {
		unset($item['_source_order'], $item['_row_order']);
	}
	unset($item);
	return array('items' => $items, 'errors' => $errors);
}
