import { describe, expect, test } from 'vitest'
import { administrativeReminderSchedule } from './administrative-reminder'

describe('administrativeReminderSchedule', () => {
  test('returns the approved deadline and reminder date inside the 21-day window', () => {
    expect(
      administrativeReminderSchedule(
        {
          approved_revision_id: 'revision-1',
          planned_end: '2027-02-10',
          approved: { planned_end: '2027-01-31' },
          state: 'approved',
          closure: null,
        },
        '2027-01-15',
      ),
    ).toEqual({ plannedEnd: '2027-01-31', dueOn: '2027-01-10' })
  })

  test.each([
    ['before the reminder window', { planned_end: '2027-01-31' }, '2027-01-09'],
    ['after the deadline', { planned_end: '2027-01-31' }, '2027-02-01'],
    [
      'after closure',
      { planned_end: '2027-01-31', closure: { closed_at: '2027-01-20' } },
      '2027-01-20',
    ],
    [
      'after withdrawal',
      { planned_end: '2027-01-31', state: 'withdrawn' },
      '2027-01-20',
    ],
    [
      'without an approved revision',
      { planned_end: '2027-01-31', approved_revision_id: null },
      '2027-01-20',
    ],
  ])('returns no reminder %s', (_label, overrides, today) => {
    expect(
      administrativeReminderSchedule(
        {
          approved_revision_id: 'revision-1',
          state: 'approved',
          closure: null,
          ...overrides,
        },
        today,
      ),
    ).toBeNull()
  })
})
