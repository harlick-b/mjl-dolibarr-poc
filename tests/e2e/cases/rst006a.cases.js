'use strict';

const LIST_PAGE_CASES = Object.freeze([
  Object.freeze({ name: 'zero-result cohort renders no rows or pagination', query: 'Cardinalité zéro', page: 1, count: 0, previous: false, next: false }),
  Object.freeze({ name: 'one-result cohort renders one row without pagination', query: 'Cardinalité 1 unique', page: 1, count: 1, previous: false, next: false }),
  Object.freeze({ name: '50-result cohort renders the exact cutoff without Next', query: 'Cardinalité 50 item', page: 1, count: 50, previous: false, next: false }),
  Object.freeze({ name: '51-result cohort page 1 renders 50 rows with Next', query: 'Cardinalité 51 item', page: 1, count: 50, previous: false, next: true }),
  Object.freeze({ name: '51-result cohort page 2 renders one row with Previous', query: 'Cardinalité 51 item', page: 2, count: 1, previous: true, next: false }),
  Object.freeze({ name: 'list page 1 renders 50 of 101 Activities', query: 'Pagination', page: 1, count: 50, previous: false, next: true }),
  Object.freeze({ name: 'list page 2 renders the middle 50 Activities', query: 'Pagination', page: 2, count: 50, previous: true, next: true }),
  Object.freeze({ name: 'list page 3 renders the final Activity', query: 'Pagination', page: 3, count: 1, previous: true, next: false }),
]);

const INVALID_FILTER_CASES = Object.freeze([
  Object.freeze({ name: 'list rejects an unknown status', query: 'status=UNKNOWN' }),
  Object.freeze({ name: 'list rejects page zero', query: 'page=0' }),
  Object.freeze({ name: 'list rejects an overflowing project identifier', query: 'project_id=9223372036854775808' }),
  Object.freeze({ name: 'list rejects a search longer than 100 characters', query: `q=${'a'.repeat(101)}` }),
  Object.freeze({ name: 'web stack rejects malformed UTF-8 search bytes', query: 'q=%FF', status: 403 }),
  Object.freeze({ name: 'list rejects a leading control character before trimming', query: 'q=%0Aabc' }),
  Object.freeze({ name: 'list rejects a trailing control character before trimming', query: 'q=abc%09' }),
]);

const LITERAL_SEARCH_CASES = Object.freeze([
  Object.freeze({ name: 'percent is searched as a literal wildcard character', query: '%' }),
  Object.freeze({ name: 'underscore is searched as a literal wildcard character', query: '_' }),
]);

module.exports = { LIST_PAGE_CASES, INVALID_FILTER_CASES, LITERAL_SEARCH_CASES };
