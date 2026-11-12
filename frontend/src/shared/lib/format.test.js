import { expect, test } from 'vitest'
import { formatDate, formatDateTime, formatXof } from './format'

test('date-only values keep their calendar day and invalid dates stay unknown', () => {
  expect(formatDate('2026-11-12')).toBe('12 novembre 2026')
  expect(formatDate('2026-11-12T23:30:00Z')).toBe('12 novembre 2026')
  expect(formatDate('2026-02-30')).toBe('—')
  expect(formatDate('12/11/2026')).toBe('—')
  expect(formatDate('2026-11-12Tinvalid')).toBe('—')
  expect(formatDate(null)).toBe('—')
})

test('timestamps use Benin time even when UTC falls on the previous day', () => {
  expect(formatDateTime('2026-09-28T23:30:00Z')).toBe(
    '29 septembre 2026 à 00:30',
  )
  expect(formatDateTime('invalid')).toBe('—')
  expect(formatDateTime(null)).toBe('—')
})

test('unknown XOF amounts remain distinct from a genuine zero', () => {
  for (const missing of [null, undefined, ''])
    expect(formatXof(missing)).toBe('—')
  expect(formatXof('0')).toBe('0 F CFA')
  expect(formatXof('9007199254740993').replaceAll('\u202f', ' ')).toBe(
    '9 007 199 254 740 993 F CFA',
  )
  expect(formatXof('12.5')).toBe('—')
  expect(formatXof('inconnu')).toBe('—')
  expect(formatXof(Number.MAX_SAFE_INTEGER + 1)).toBe('—')
  expect(formatXof(-1)).toBe('-1 F CFA')
})
