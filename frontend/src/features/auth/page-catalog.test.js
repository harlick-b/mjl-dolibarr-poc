import { test, expect } from 'vitest'
import { authorization, workspacePath, pageForPath } from './authorization'
const session = (role) => ({ state: 'verified', user: { id: 'fixture', role } })
test.each([
  'ADMIN_PLATEFORME',
  'AGENT_SAISIE',
  'AGENT_VERIFICATEUR',
  'VALIDATEUR_DEFINITIF',
  'PARTENAIRE',
])(
  'every %s has Dashboard as its default and navigation obeys its page access',
  (role) => {
    const policy = authorization(session(role))
    expect(workspacePath(role)).toBe('/dashboard')
    expect(policy.navigation[0].path).toBe('/dashboard')
    for (const page of policy.navigation)
      expect(policy.canVisit(page.path)).toBe(true)
  },
)
test('Admin and Partner cannot open internal planning via a direct URL', () => {
  for (const role of ['ADMIN_PLATEFORME', 'PARTENAIRE'])
    expect(authorization(session(role)).canVisit('/activities/fixture')).toBe(
      false,
    )
  expect(
    authorization(session('AGENT_SAISIE')).canVisit('/activities/fixture'),
  ).toBe(true)
  expect(authorization(session('AGENT_SAISIE')).canVisit('/history')).toBe(
    false,
  )
  expect(pageForPath('/execution/activities/fixture').id).toBe('execution')
})
test('unverified or unknown roles never receive navigation or page access', () => {
  for (const input of [null, { state: 'pending' }, session('unknown')]) {
    expect(authorization(input).navigation).toEqual([])
    expect(authorization(input).canVisit('/dashboard')).toBe(false)
  }
})

test('catalog management is Validator only and Partner exports are scoped', () => {
  for (const role of ['AGENT_SAISIE', 'AGENT_VERIFICATEUR']) {
    const access = authorization(session(role))
    expect(access.navigation.map((page) => page.id)).toEqual([
      'dashboard',
      'planning',
      'execution',
    ])
    expect(access.canVisit('/projects')).toBe(false)
    expect(access.canVisit('/partners')).toBe(false)
    expect(access.canVisit('/projects/fixture/ptas/2026')).toBe(true)
  }
  expect(
    authorization(session('PARTENAIRE')).navigation.map((page) => page.id),
  ).toEqual(['dashboard', 'partner', 'exports'])
  expect(
    authorization(session('AGENT_SAISIE')).canVisit('/partner/exports'),
  ).toBe(false)
})
