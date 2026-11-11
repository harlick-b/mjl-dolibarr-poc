import { test, expect } from 'vitest'
import { loginDestination, rememberPage } from './navigation'
const session = (id, role = 'AGENT_SAISIE') => ({
  state: 'verified',
  user: { id, role },
})
test('return destinations are scoped to identity and current role', () => {
  const agent = session('return-agent')
  rememberPage(agent, '/notifications')
  expect(loginDestination(agent)).toBe('/notifications')
  expect(loginDestination(session('other-agent'))).toBe('/dashboard')
  expect(loginDestination(session('return-agent', 'ADMIN_PLATEFORME'))).toBe(
    '/access/users',
  )
  rememberPage(agent, '/access/users')
  rememberPage(agent, '//evil.example')
  rememberPage(agent, '/login#verifier=secret')
  expect(loginDestination(agent)).toBe('/notifications')
})
test('resource destinations stay in memory and never persist proofs or filters', () => {
  const agent = session('detail-agent')
  rememberPage(agent, '/activities/activity-1')
  expect(loginDestination(agent)).toBe('/activities/activity-1')
  expect(
    sessionStorage.getItem('mjl.last-page:detail-agent:AGENT_SAISIE'),
  ).toBeNull()
  rememberPage(agent, '/projects?email=private@example.test')
  expect(loginDestination(agent)).toBe('/activities/activity-1')
})
test('untrusted saved destinations cannot override role access', () => {
  const agent = session('stored-agent')
  sessionStorage.setItem(
    'mjl.last-page:stored-agent:AGENT_SAISIE',
    '/access/users',
  )
  expect(loginDestination(agent)).toBe('/dashboard')
})

test('an authorized email destination survives login without accepting unsafe paths', () => {
  const agent = session('email-agent')
  expect(loginDestination(agent, '/activities/activity-1')).toBe(
    '/activities/activity-1',
  )
  expect(loginDestination(agent, '/access/users')).toBe('/dashboard')
  expect(loginDestination(agent, '//evil.example')).toBe('/dashboard')
})
