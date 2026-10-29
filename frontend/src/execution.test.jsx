import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from './router.jsx'

afterEach(() => vi.unstubAllGlobals())

function detail({ started = false, completed = false } = {}) {
  return {
    id: 'activity-1',
    pta_id: 'pta-1',
    project_id: 'project-1',
    reference: 'ACT-000001',
    name: 'Former les équipes',
    planned_start: '2026-10-28',
    planned_end: '2026-12-31',
    approved_allocation: '100000',
    approved_revision_id: '11111111-1111-4111-8111-111111111111',
    version: started ? (completed ? 7 : 6) : 5,
    execution_paused: false,
    pause_reason: null,
    completed_operations: completed ? 1 : 0,
    operation_count: 1,
    works_completed: completed,
    spending_total: completed ? '100000' : null,
    allowed_actions: ['read'],
    operations: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        type_id: 'type-1',
        type_label: 'Formation',
        name: 'Préparer la session',
        approved_allocation: '100000',
        position: 1,
        execution_started_at: started ? '2026-10-28T09:00:00Z' : null,
        execution_completed: completed,
        actual_spent: completed ? '100000' : null,
        execution_observation: completed ? 'Session terminée.' : '',
        variance: completed ? '0' : null,
        allowed_actions: started ? ['record'] : ['start'],
      },
    ],
  }
}

test('Agent starts and records an Operation without offline replay', async () => {
  const user = userEvent.setup()
  let current = detail()
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: { id: 'agent', role: 'AGENT_SAISIE' },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/execution/history'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/disbursement-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.includes('/operations/') && options.method === 'PATCH') {
      const body = JSON.parse(options.body)
      current =
        body.action === 'start'
          ? detail({ started: true })
          : detail({ started: true, completed: true })
      return Promise.resolve(new Response(JSON.stringify(current)))
    }
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(current)))
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  expect(
    await screen.findByRole('heading', { name: 'Former les équipes' }),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Démarrer' }))
  expect(await screen.findByLabelText('Montant dépensé (XOF)')).toBeVisible()
  await user.type(screen.getByLabelText('Montant dépensé (XOF)'), '100000')
  await user.type(screen.getByLabelText('Observation'), 'Session terminée.')
  await user.click(screen.getByLabelText('Opération terminée'))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('Travaux terminés')).toBeVisible()
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/operations/22222222-2222-4222-8222-222222222222/execution',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          action: 'record',
          expected_version: 6,
          expected_approved_revision_id: '11111111-1111-4111-8111-111111111111',
          actual_spent: '100000',
          execution_completed: true,
          execution_observation: 'Session terminée.',
        }),
      }),
    ),
  )
})

test('Agent submits finalized spending for disbursement authorization', async () => {
  const user = userEvent.setup()
  let requests = []
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: { id: 'agent', role: 'AGENT_SAISIE' },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/execution/history'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/disbursement-requests') && options.method === 'POST') {
      requests = [
        {
          id: '33333333-3333-4333-8333-333333333333',
          activity_id: 'activity-1',
          amount: '100000',
          state: 'submitted',
          activity_version: 8,
          decisions: [],
          cancellation: null,
          allowed_actions: ['read', 'cancel'],
        },
      ]
      return Promise.resolve(new Response(JSON.stringify(requests[0])))
    }
    if (path.endsWith('/cancellation') && options.method === 'POST') {
      requests[0] = {
        ...requests[0],
        state: 'cancelled',
        activity_version: 9,
        cancellation: { reason: 'Corriger les montants.' },
        allowed_actions: ['read'],
      }
      return Promise.resolve(new Response(JSON.stringify(requests[0])))
    }
    if (path.includes('/disbursement-requests/'))
      return Promise.resolve(new Response(JSON.stringify(requests[0])))
    if (path.endsWith('/disbursement-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: requests.length,
            data: requests,
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(
        new Response(
          JSON.stringify(detail({ started: true, completed: true })),
        ),
      )
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  await user.click(
    await screen.findByRole('button', {
      name: /Soumettre 100.*000 XOF/,
    }),
  )
  expect(
    (await screen.findAllByText('Soumise au Superviseur'))[0],
  ).toBeVisible()
  expect(
    screen.getByText(/ne signifie pas que le paiement a été effectué/i),
  ).toBeVisible()
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/disbursement-requests',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expected_version: 7,
          expected_approved_revision_id: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    ),
  )
  await user.click(
    screen.getByRole('button', {
      name: /Soumise au Superviseur.*100.*000 XOF/,
    }),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/disbursement-requests/33333333-3333-4333-8333-333333333333',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ),
  )
  await user.type(
    screen.getByLabelText('Motif obligatoire'),
    'Corriger les montants.',
  )
  await user.click(screen.getByRole('button', { name: 'Annuler la demande' }))
  expect(
    await screen.findByRole('button', { name: /Soumettre 100.*000 XOF/ }),
  ).toBeVisible()
})

test('offline invalidation aborts and clears a pending financial mutation', async () => {
  const user = userEvent.setup()
  let mutationSignal
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: { id: 'agent', role: 'AGENT_SAISIE' },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/execution/history'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/disbursement-requests') && options.method === 'POST') {
      mutationSignal = options.signal
      return new Promise((_resolve, reject) =>
        options.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        ),
      )
    }
    if (path.endsWith('/disbursement-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(
        new Response(
          JSON.stringify(detail({ started: true, completed: true })),
        ),
      )
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  const router = makeRouter(
    createMemoryHistory({
      initialEntries: ['/execution/activities/activity-1'],
    }),
  )
  render(<App router={router} />)
  await user.click(
    await screen.findByRole('button', { name: /Soumettre 100.*000 XOF/ }),
  )
  await waitFor(() => expect(mutationSignal).toBeDefined())
  window.dispatchEvent(new Event('offline'))
  expect(await screen.findByText(/Reconnectez-vous/)).toBeVisible()
  expect(mutationSignal.aborted).toBe(true)
  expect(
    router.options.context.queryClient.getMutationCache().getAll(),
  ).toEqual([])
})
