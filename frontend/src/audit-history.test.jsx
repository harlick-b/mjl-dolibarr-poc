import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from './router'

afterEach(() => vi.unstubAllGlobals())

test('validator browses the sanitized global history', async () => {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      calls.push(path)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: { id: 'validator', role: 'VALIDATEUR_DEFINITIF' },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: [
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
  expect(
    await screen.findByRole('heading', { name: 'Historique' }),
  ).toBeVisible()
  expect(screen.getByText('Activité clôturée')).toBeVisible()
  expect(screen.getByText('Événement enregistré')).toBeVisible()
  expect(screen.getByText('Résultat enregistré')).toBeVisible()
  expect(screen.getByRole('link', { name: /ACT-001/ })).toHaveAttribute(
    'href',
    '/activities/activity-1',
  )
  expect(
    screen.queryByRole('button', { name: /Exporter/ }),
  ).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Suivant' }))
  await waitFor(() =>
    expect(calls.some((path) => path.includes('cursor=next-page'))).toBe(true),
  )
  window.dispatchEvent(new Event('offline'))
  expect(
    await screen.findByRole('heading', { name: 'Vérification de l’accès' }),
  ).toBeVisible()
  expect(screen.queryByText('Activité clôturée')).not.toBeInTheDocument()
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
            user: { id: 'agent', role: 'AGENT_SAISIE' },
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
  expect(await screen.findByRole('alert')).toHaveTextContent('pas accès')
})
