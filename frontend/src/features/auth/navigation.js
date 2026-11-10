import { authorization } from './authorization'

// Remember route choices, never search values, fragments, proofs or form data.
// Resource URLs stay in memory; only non-sensitive top-level choices survive reload.
const recent = new Map()
const key = (user) => `mjl.last-page:${user.id}:${user.role}`
export const canVisit = (session, path) =>
  typeof path === 'string' && authorization(session).canVisit(path)
const isTopLevel = (session, path) =>
  authorization(session).navigation.some((page) => page.path === path)

export function rememberPage(session, path) {
  if (!canVisit(session, path) || path.endsWith('/new')) return
  const storageKey = key(session.user)
  recent.set(storageKey, path)
  if (isTopLevel(session, path)) {
    try {
      sessionStorage.setItem(storageKey, path)
    } catch {
      /* Optional preference. */
    }
  }
}

export function loginDestination(session, requested) {
  const policy = authorization(session)
  if (!policy.user) return '/login'
  if (canVisit(session, requested)) return requested
  const storageKey = key(policy.user)
  let path = recent.get(storageKey)
  if (!path) {
    try {
      const stored = sessionStorage.getItem(storageKey)
      if (isTopLevel(session, stored)) path = stored
    } catch {
      /* Storage may be unavailable. */
    }
  }
  return canVisit(session, path) ? path : policy.workspace
}
