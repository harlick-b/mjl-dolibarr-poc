export function cursorFrom(link, expectedPath) {
  if (!link) return ''
  try {
    const parsed = new URL(link, window.location.origin)
    if (
      parsed.origin !== window.location.origin ||
      parsed.pathname !== `/api/v1${expectedPath}`
    )
      return ''
    return parsed.searchParams.get('cursor') || ''
  } catch {
    return ''
  }
}

export async function findPaginatedItem({
  api,
  path,
  id,
  signal,
  firstPage,
  limit = 60,
}) {
  if (!id) return null
  let page = firstPage
  let cursor = ''
  const visited = new Set()

  while (true) {
    if (!page) {
      const query = new URLSearchParams({
        limit: String(limit),
        ...(cursor ? { cursor } : {}),
      })
      page = await api.request(`/api/v1${path}?${query}`, { signal })
    }
    const item = page.data?.find((row) => row.id === id)
    if (item) return item

    const next = cursorFrom(page.next, path)
    if (!next || visited.has(next)) return null
    visited.add(next)
    cursor = next
    page = null
  }
}
