import { strings } from '@/locales/fr/PlanningView'

// Table cursors never participate in the annual calendar query.
export async function readCalendar(api, ptaId, filters, signal) {
  const pathname = `/api/v1/ptas/${ptaId}/activities`
  const params = new URLSearchParams({
    limit: '100',
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.state ? { state: filters.state } : {}),
  })
  let path = `${pathname}?${params}`
  const visited = new Set()
  const ids = new Set()
  const data = []
  let count
  while (path) {
    signal.throwIfAborted()
    if (visited.has(path)) throw new Error(strings.calendarChanged)
    visited.add(path)
    const page = await api.request(path, { signal })
    if (
      !Number.isInteger(page.count) ||
      page.count < 0 ||
      !Array.isArray(page.data)
    )
      throw new Error(strings.calendarChanged)
    count ??= page.count
    if (page.count !== count) throw new Error(strings.calendarChanged)
    for (const row of page.data) {
      if (!row.id || ids.has(row.id)) throw new Error(strings.calendarChanged)
      ids.add(row.id)
      data.push(row)
    }
    if (data.length > count || (page.next && !page.data.length))
      throw new Error(strings.calendarChanged)
    if (!page.next) break
    const next = new URL(page.next, window.location.origin)
    if (
      next.origin !== window.location.origin ||
      next.pathname !== pathname ||
      !next.searchParams.get('cursor') ||
      next.searchParams.get('limit') !== '100' ||
      (next.searchParams.get('q') || '') !== (filters.q?.trim() || '') ||
      (next.searchParams.get('state') || '') !== (filters.state || '')
    )
      throw new Error(strings.calendarChanged)
    path = next.pathname + next.search
  }
  if (data.length !== count) throw new Error(strings.calendarChanged)
  return { object: 'list', count, data, next: null, previous: null }
}
