import { localDateInput } from '@/shared/lib/format'

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

function shiftCalendarDay(value, days) {
  if (!CALENDAR_DAY.test(value || '')) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    return null
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function administrativeReminderSchedule(
  activity,
  today = localDateInput(),
) {
  if (
    !activity?.approved_revision_id ||
    activity.closure ||
    ['closed', 'withdrawn'].includes(activity.state)
  )
    return null

  const plannedEnd = activity.approved?.planned_end || activity.planned_end
  const dueOn = shiftCalendarDay(plannedEnd, -21)
  if (!dueOn || today < dueOn || today > plannedEnd) return null
  return { plannedEnd, dueOn }
}
