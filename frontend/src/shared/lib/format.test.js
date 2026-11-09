import { expect, test } from 'vitest'
import { formatDateTime, formatXof } from './format'

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
})
