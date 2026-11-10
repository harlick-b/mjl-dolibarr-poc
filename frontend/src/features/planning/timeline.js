const DAY = 86_400_000

export function utcDay(value) {
  return Date.parse(`${value}T00:00:00Z`) / DAY
}

export function timelineWindow(year, month) {
  const start = new Date(Date.UTC(year, month ? month - 1 : 0, 1))
  const end = new Date(Date.UTC(year, month || 12, 0))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    days:
      utcDay(end.toISOString().slice(0, 10)) -
      utcDay(start.toISOString().slice(0, 10)) +
      1,
  }
}

export function timelinePosition(row, window) {
  if (!row.planned_start) return null
  const start = utcDay(row.planned_start)
  const end = utcDay(row.planned_end || row.planned_start)
  const first = utcDay(window.start)
  const last = utcDay(window.end)
  if (end < first || start > last) return null
  const clippedStart = Math.max(start, first)
  const clippedEnd = Math.min(end, last)
  return {
    left: ((clippedStart - first) / window.days) * 100,
    width: Math.max(((clippedEnd - clippedStart + 1) / window.days) * 100, 0.7),
    before: start < first,
    after: end > last,
    marker: !row.planned_end,
  }
}
