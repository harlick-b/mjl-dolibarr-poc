import { test, expect } from 'vitest'
import { loginDestination, rememberPage } from './navigation'
const session = (id, role = 'AGENT_SAISIE') => ({
  state: 'verified',
  user: { id, role },
})
test('return destinations are scoped to identity and current role', () => {
  const agent = session('return-agent')
  rememberPage(agent, '/planning')
  expect(loginDestination(agent)).toBe('/planning')
  expect(loginDestination(session('other-agent'))).toBe('/dashboard')
  expect(loginDestination(session('return-agent', 'ADMIN_PLATEFORME'))).toBe(
    '/access/users',
  )
  rememberPage(agent, '/access/users')
  rememberPage(agent, '//evil.example')
  rememberPage(agent, '/login#verifier=secret')
  expect(loginDestination(agent)).toBe('/planning')
})
test('resource destinations do not replace the last top-level module', () => {
  const agent = session('detail-agent')
  rememberPage(agent, '/planning')
  rememberPage(agent, '/planning/activities/activity-1')
  expect(loginDestination(agent)).toBe('/planning')
  expect(
    sessionStorage.getItem('mjl.last-page:detail-agent:AGENT_SAISIE'),
  ).toBe('/planning')
  rememberPage(agent, '/projects?email=private@example.test')
  expect(loginDestination(agent)).toBe('/planning')
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
  expect(loginDestination(agent, '/execution/activities/activity-1')).toBe(
    '/execution/activities/activity-1',
  )
  expect(loginDestination(agent, '/access/users')).toBe('/dashboard')
  expect(loginDestination(agent, '//evil.example')).toBe('/dashboard')
})
