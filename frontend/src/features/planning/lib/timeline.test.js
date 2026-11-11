import { expect, test } from 'vitest'
import { timelinePosition, timelineWindow } from './timeline'

test('annual timeline clips cross-year spans and preserves leap-day length', () => {
  const window = timelineWindow(2028)
  expect(window.days).toBe(366)
  const position = timelinePosition(
    {
      planned_start: '2027-12-20',
      planned_end: '2029-01-10',
    },
    window,
  )
  expect(position).toMatchObject({
    left: 0,
    width: 100,
    before: true,
    after: true,
  })
})

test('monthly timeline renders a start-only activity as a marker on its actual day', () => {
  const window = timelineWindow(2028, 2)
  expect(window.days).toBe(29)
  const position = timelinePosition(
    { planned_start: '2028-02-29', planned_end: null },
    window,
  )
  expect(position.marker).toBe(true)
  expect(position.left).toBeCloseTo((28 / 29) * 100)
})

test('annual positions align leap-year month boundaries by day count', () => {
  const window = timelineWindow(2028)
  const february = timelinePosition(
    { planned_start: '2028-02-01', planned_end: '2028-02-29' },
    window,
  )
  expect(february.left).toBeCloseTo((31 / 366) * 100)
  expect(february.width).toBeCloseTo((29 / 366) * 100)
})
