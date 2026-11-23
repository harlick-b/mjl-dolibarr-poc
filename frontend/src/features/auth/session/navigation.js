import { Urls } from '@/app/urls'
import { authorization } from './authorization'

// Remember only visible top-level modules, never resources, search values,
// fragments, proofs or form data.
const key = (user) => `mjl.last-page:${user.id}:${user.role}`
export const canVisit = (session, path) =>
  typeof path === 'string' && authorization(session).canVisit(path)
const isTopLevel = (session, path) =>
  authorization(session).navigation.some((page) => page.path === path)

export function rememberPage(session, path) {
  if (!canVisit(session, path) || !isTopLevel(session, path)) return
  const storageKey = key(session.user)
  try {
    sessionStorage.setItem(storageKey, path)
  } catch {
    /* Optional preference. */
  }
}

export function loginDestination(session, requested) {
  const policy = authorization(session)
  if (!policy.user) return Urls.login
  if (canVisit(session, requested)) return requested
  const storageKey = key(policy.user)
  let path
  try {
    const stored = sessionStorage.getItem(storageKey)
    if (isTopLevel(session, stored)) path = stored
  } catch {
    /* Storage may be unavailable. */
  }
  return canVisit(session, path) ? path : policy.workspace
}
