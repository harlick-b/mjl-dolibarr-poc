import { expect, test } from 'vitest'
import { formatDateTime } from './format'

test('timestamps use Benin time even when UTC falls on the previous day', () => {
  expect(formatDateTime('2026-09-28T23:30:00Z')).toBe(
    '29 septembre 2026 à 00:30',
  )
  expect(formatDateTime('invalid')).toBe('—')
  expect(formatDateTime(null)).toBe('—')
})
