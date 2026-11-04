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
