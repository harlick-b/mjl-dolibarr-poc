import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('validator browses the sanitized global history', async () => {
  const calls = []
  let exported = false
  const createObjectURL = vi.fn(() => 'blob:history')
  const revokeObjectURL = vi.fn()
  const NativeURL = URL
  class DownloadURL extends NativeURL {}
  DownloadURL.createObjectURL = createObjectURL
  DownloadURL.revokeObjectURL = revokeObjectURL
  vi.stubGlobal('URL', DownloadURL)
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options = {}) => {
      const path = String(url)
      calls.push([path, options])
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: {
                id: 'validator',
                email: 'user@example.test',
                role: 'VALIDATEUR_DEFINITIF',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (path.includes('/reports/audit/exports')) {
        exported = true
        return Promise.resolve(
          new Response('csv', {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition':
                'attachment; filename="historique-audit-test.csv"',
            },
          }),
        )
      }
      const exportEvent = exported
        ? [
            {
              id: 13,
              occurred_at: '2028-02-08T09:01:00Z',
              action: 'audit.export',
              label: 'Historique exporté',
              outcome: 'ok',
              actor: {
                id: 'validator',
                email: 'validator@example.test',
              },
              activity: null,
            },
          ]
        : []
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2 + exportEvent.length,
            data: [
              ...exportEvent,
              {
                id: 12,
                occurred_at: '2028-02-08T09:00:00Z',
                action: 'activity.closed',
                label: 'Activité clôturée',
                outcome: 'ok',
                actor: {
                  id: 'validator',
                  email: 'validator@example.test',
                },
                activity: {
                  id: 'activity-1',
                  reference: 'ACT-001',
                  name: 'Formation',
                },
              },
              {
                id: 11,
                occurred_at: '2028-02-07T09:00:00Z',
                action: 'future.event',
                label: 'Événement enregistré',
                outcome: 'future_outcome',
                actor: null,
                activity: null,
              },
            ],
            next: `${window.location.origin}/api/v1/audit-events?limit=60&cursor=next-page`,
            previous: null,
          }),
        ),
      )
    }),
  )
  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/history'] }))}
    />,
  )
  await screen.findByText('Activité clôturée')
  expect(screen.getByRole('heading', { name: 'Historique' })).toBeVisible()
  expect(screen.getByText('Activité clôturée')).toBeVisible()
  expect(screen.getByText('Événement enregistré')).toBeVisible()
  expect(screen.getByText('Résultat enregistré')).toBeVisible()
  expect(screen.getByRole('link', { name: /ACT-001/ })).toHaveAttribute(
    'href',
    '/activities/activity-1',
  )
  expect(screen.queryByRole('button', { name: /Exporter/ })).toBeVisible()
  const online = vi.spyOn(window.navigator, 'onLine', 'get')
  online.mockReturnValue(false)
  await userEvent.click(screen.getByRole('button', { name: 'Exporter le CSV' }))
  expect(calls.some(([path]) => path.includes('/reports/audit/exports'))).toBe(
    false,
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Exporter le CSV' }),
    ).toBeEnabled(),
  )
  online.mockReturnValue(true)
  await userEvent.click(screen.getByRole('button', { name: 'Exporter le CSV' }))
  await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
  expect(click).toHaveBeenCalled()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:history')
  const exportCalls = calls.filter(([path]) =>
    path.includes('/reports/audit/exports'),
  )
  expect(exportCalls).toHaveLength(1)
  expect(exportCalls[0][1]).toEqual(
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ format: 'csv' }),
    }),
  )
  expect(await screen.findByText('Historique exporté')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Suivant' }))
  await waitFor(() =>
    expect(calls.some(([path]) => path.includes('cursor=next-page'))).toBe(
      true,
    ),
  )
  window.dispatchEvent(new Event('offline'))
  expect(
    await screen.findByRole('heading', { name: 'Connexion indisponible' }),
  ).toBeVisible()
  expect(screen.queryByText('Activité clôturée')).not.toBeInTheDocument()
  window.dispatchEvent(new Event('online'))
  expect(await screen.findByText('Activité clôturée')).toBeVisible()
})

test('ordinary business roles cannot open the global history', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      ),
    ),
  )
  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/history'] }))}
    />,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé')
  expect(
    screen.getByRole('link', { name: 'Retour à mon espace' }),
  ).toBeVisible()
})
