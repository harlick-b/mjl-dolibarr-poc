import { expect, test } from '@playwright/test'

test('a cross-tab revocation removes protected data and requires a fresh sign-in', async ({
  page,
}) => {
  let revoked = false
  let revokedSessionReads = 0
  let releaseRevokedSession
  const revokedSessionGate = new Promise((resolve) => {
    releaseRevokedSession = resolve
  })
  const notifications = {
    object: 'list',
    count: 1,
    data: [
      {
        kind: 'activity_review',
        stage: 'supervisor',
        id: 'notice-secret',
        activity_id: 'activity-secret',
        activity_reference: 'ACT-SECRET',
        activity_name: 'Activité confidentielle',
        pta_year: 2026,
        created_at: '2026-11-19T09:00:00Z',
        read_at: null,
        handled_at: null,
        email_status: 'delivered',
        version: 1,
      },
    ],
    next: null,
    previous: null,
  }

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    if (path === '/api/v1/auth/session' && method === 'GET') {
      if (!revoked)
        return route.fulfill({
          json: {
            state: 'verified',
            csrf: 'current-csrf',
            user: {
              id: 'agent-old',
              email: 'old-account@example.test',
              role: 'AGENT_VERIFICATEUR',
              full_name: 'Ancien compte',
            },
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          },
        })
      revokedSessionReads += 1
      if (revokedSessionReads === 1) {
        await revokedSessionGate
        return route.fulfill({
          status: 401,
          json: {
            code: 'session_expired',
            message:
              'Vérification refusée. Vérifiez votre demande et réessayez.',
          },
        })
      }
      return route.fulfill({
        json: { state: 'anonymous', csrf: 'fresh-csrf' },
      })
    }
    if (path === '/api/v1/notifications' && method === 'GET')
      return route.fulfill({ json: notifications })
    throw new Error(`Unexpected API request: ${method} ${path}`)
  })

  await page.goto('/notifications')
  await expect(
    page.getByText('Activité confidentielle', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mon compte' })).toContainText(
    'Ancien compte',
  )

  revoked = true
  await page.evaluate(() => {
    const channel = new BroadcastChannel('mjl-auth')
    channel.postMessage('revoked')
    channel.close()
  })

  await expect(
    page.getByRole('heading', { name: 'Vérification de votre accès' }),
  ).toBeVisible()
  await expect(
    page.getByText('Activité confidentielle', { exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mon compte' })).toHaveCount(0)
  await expect(page.locator('[data-ui="access-sidebar"]')).toHaveCount(0)

  releaseRevokedSession()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  await expect(
    page.getByText('Activité confidentielle', { exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mon compte' })).toHaveCount(0)
  await expect(page.locator('[data-ui="access-sidebar"]')).toHaveCount(0)
  expect(revokedSessionReads).toBe(2)
})
