import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from './router.jsx'
import { cursorFrom } from './pagination'

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
    state: 'approved',
    closure: null,
    closure_blockers: ['execution_incomplete'],
    execution_paused: false,
    pause_reason: null,
    completed_operations: completed ? 1 : 0,
    operation_count: 1,
    works_completed: completed,
    spending_total: completed ? '100000' : null,
    virement_context: {
      disbursement_request_id: null,
      amount: null,
      current_request_id: null,
      current_state: null,
      can_submit: false,
      unavailable_reason: 'disbursement_required',
    },
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

test('an observation draft keeps its version across refresh and can be explicitly reset', async () => {
  const user = userEvent.setup()
  let current = detail({ started: true, completed: true })
  const writes = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = String(url)
      if (options.method === 'PATCH') {
        writes.push(JSON.parse(options.body))
        if (writes.length === 1)
          return new Response(JSON.stringify({ code: 'activity_stale' }), {
            status: 409,
          })
        return new Response(JSON.stringify({ ...current, version: 9 }))
      }
      let body = {
        object: 'list',
        count: 0,
        data: [],
        next: null,
        previous: null,
      }
      if (path.includes('/auth/session'))
        body = {
          state: 'verified',
          csrf: 'csrf',
          user: { id: 'agent', role: 'AGENT_SAISIE' },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        }
      else if (path.endsWith('/activities/activity-1/execution')) body = current
      return new Response(JSON.stringify(body))
    }),
  )
  const router = makeRouter(
    createMemoryHistory({
      initialEntries: ['/execution/activities/activity-1'],
    }),
  )
  render(<App router={router} />)
  await user.type(
    await screen.findByLabelText('Observation'),
    ' Précision locale.',
  )
  await user.type(
    screen.getByLabelText('Motif de la correction'),
    'Préciser le compte rendu.',
  )
  current = {
    ...current,
    version: 8,
    operations: [
      {
        ...current.operations[0],
        actual_spent: '110000',
        execution_completed: false,
        execution_observation: 'Correction distante.',
      },
    ],
  }
  await act(async () =>
    router.options.context.queryClient.setQueryData(
      ['execution', 'agent', 'activity', 'activity-1'],
      current,
    ),
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer', exact: true }),
  )
  await waitFor(() =>
    expect(writes[0]).toEqual(
      expect.objectContaining({
        expected_version: 7,
        execution_observation: 'Session terminée. Précision locale.',
      }),
    ),
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Annuler la saisie' }),
    ).toBeEnabled(),
  )
  await user.click(screen.getByRole('button', { name: 'Annuler la saisie' }))
  expect(screen.getByLabelText('Observation')).toHaveValue(
    'Correction distante.',
  )
  expect(screen.getByLabelText('Montant dépensé (XOF)')).toHaveValue('110000')
  expect(screen.getByLabelText('Opération terminée')).not.toBeChecked()
  await user.type(screen.getByLabelText('Observation'), ' Complément.')
  await user.type(screen.getByLabelText('Motif de la correction'), 'Compléter.')
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer', exact: true }),
  )
  await waitFor(() =>
    expect(writes[1]).toEqual(expect.objectContaining({ expected_version: 8 })),
  )
})

test('Agent confirms eligible Activity closure and sees terminal evidence', async () => {
  const user = userEvent.setup()
  let current = {
    ...detail({ started: true, completed: true }),
    version: 11,
    closure_blockers: [],
    allowed_actions: ['read', 'close'],
  }
  const emptyList = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
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
    if (path.endsWith('/closure') && options.method === 'POST') {
      current = {
        ...current,
        state: 'closed',
        version: 12,
        closure: {
          closed_by_id: 'agent',
          closed_at: '2026-10-30T15:00:00Z',
        },
        allowed_actions: ['read'],
      }
      return Promise.resolve(new Response(JSON.stringify(current)))
    }
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(current)))
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(new Response(JSON.stringify(emptyList)))
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
  const button = await screen.findByRole('button', {
    name: 'Clôturer l’activité',
  })
  const confirmation = screen.getByLabelText(
    /Je confirme que l’Activité est entièrement réalisée/,
  )
  expect(confirmation).not.toBeChecked()
  await user.click(confirmation)
  await user.click(button)
  expect(await screen.findByText('Activité clôturée')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Clôturer l’activité' }),
  ).toBeNull()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/closure',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ expected_version: 11 }),
    }),
  )
})

test('Agent submits a zero-spending declaration without financial requests', async () => {
  const user = userEvent.setup()
  const current = {
    ...detail({ started: true, completed: true }),
    spending_total: '0',
    closure_blockers: ['zero_spending_not_approved'],
    operations: [
      {
        ...detail({ started: true, completed: true }).operations[0],
        actual_spent: '0',
        variance: '-100000',
      },
    ],
  }
  let declarations = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  const emptyList = { ...declarations }
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
    if (
      path.endsWith('/zero-spending-declarations') &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      declarations = {
        ...declarations,
        count: 1,
        data: [
          {
            id: 'zero-1',
            activity_id: current.id,
            approved_revision_id: current.approved_revision_id,
            snapshot: { total: '0', operations: [] },
            reason: body.reason,
            state: 'submitted',
            submitter_id: 'agent',
            submitted_at: '2026-11-03T10:00:00Z',
            decisions: [],
            allowed_actions: ['read'],
          },
        ],
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ ...declarations.data[0], activity_version: 8 }),
        ),
      )
    }
    if (path.endsWith('/zero-spending-declarations'))
      return Promise.resolve(new Response(JSON.stringify(declarations)))
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(current)))
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(new Response(JSON.stringify(emptyList)))
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
    await screen.findByRole('heading', {
      name: 'Déclaration de dépense nulle',
    }),
  ).toBeVisible()
  expect(screen.queryByText('Autorisation de décaissement')).toBeNull()
  expect(screen.queryByText('Autorisation de virement')).toBeNull()
  await user.type(
    screen.getByLabelText('Motif de l’absence de dépense'),
    'Les moyens propres ont suffi.',
  )
  await user.click(
    screen.getByRole('button', { name: 'Soumettre la déclaration' }),
  )
  expect(
    await screen.findByText('Motif : Les moyens propres ont suffi.'),
  ).toBeVisible()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/zero-spending-declarations',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 7,
        expected_approved_revision_id: current.approved_revision_id,
        reason: 'Les moyens propres ont suffi.',
      }),
    }),
  )
})

test.each([
  [
    'AGENT_VERIFICATEUR',
    'submitted',
    'prevalidate',
    'Prévalider',
    'Prévalidée, en attente du Validateur',
  ],
  ['VALIDATEUR_DEFINITIF', 'prevalidated', 'approve', 'Valider', 'Validée'],
])(
  '%s performs the projected zero-spending review action',
  async (role, initialState, decision, buttonLabel, finalLabel) => {
    const user = userEvent.setup()
    const current = {
      ...detail({ started: true, completed: true }),
      spending_total: '0',
      mutation_unavailable_reason: 'zero_spending_frozen',
      closure_blockers: ['zero_spending_not_approved'],
    }
    let declaration = {
      id: 'zero-1',
      activity_id: current.id,
      approved_revision_id: current.approved_revision_id,
      snapshot: { total: '0', operations: [] },
      reason: 'Les moyens propres ont suffi.',
      state: initialState,
      submitter_id: 'agent',
      submitted_at: '2026-11-03T10:00:00Z',
      decisions:
        initialState === 'prevalidated'
          ? [
              {
                id: 'decision-1',
                stage: 'supervisor',
                outcome: 'prevalidated',
                actor_id: 'supervisor',
                actor_role: 'AGENT_VERIFICATEUR',
                decided_at: '2026-11-03T11:00:00Z',
                reason: null,
                prevalidation_decision_id: null,
              },
            ]
          : [],
      allowed_actions: [decision, 'return'],
      activity_version: 7,
    }
    const emptyList = {
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }
    const fetch = vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: { id: 'reviewer', role },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/zero-spending-declarations/zero-1/decisions')) {
        declaration = {
          ...declaration,
          state: decision === 'approve' ? 'approved' : 'prevalidated',
          allowed_actions: ['read'],
          activity_version: 8,
        }
        if (decision === 'approve') {
          current.closure_blockers = []
          current.allowed_actions = ['read', 'close']
        }
        return Promise.resolve(new Response(JSON.stringify(declaration)))
      }
      if (path.endsWith('/zero-spending-declarations'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 1,
              data: [declaration],
              next: null,
              previous: null,
            }),
          ),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return Promise.resolve(new Response(JSON.stringify(current)))
      if (
        path.endsWith('/execution/history') ||
        path.endsWith('/disbursement-requests') ||
        path.endsWith('/virement-requests')
      )
        return Promise.resolve(new Response(JSON.stringify(emptyList)))
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
    if (decision === 'prevalidate') {
      expect(await screen.findByLabelText('Motif du retour')).toBeVisible()
    }
    await user.click(await screen.findByRole('button', { name: buttonLabel }))
    expect(await screen.findByText(finalLabel)).toBeVisible()
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/zero-spending-declarations/zero-1/decisions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expected_version: 7, decision }),
      }),
    )
    if (decision === 'approve') {
      expect(
        await screen.findByRole('button', { name: 'Clôturer l’activité' }),
      ).toBeVisible()
    }
  },
)

test('historical zero-spending page points to the active declaration', async () => {
  const user = userEvent.setup()
  const current = {
    ...detail({ started: true, completed: true }),
    spending_total: '0',
    mutation_unavailable_reason: 'zero_spending_frozen',
    closure_blockers: ['zero_spending_not_approved'],
  }
  const active = {
    id: 'zero-current',
    activity_id: current.id,
    approved_revision_id: current.approved_revision_id,
    snapshot: { total: '0', operations: [] },
    reason: 'Déclaration active.',
    state: 'submitted',
    submitter_id: 'agent',
    submitted_at: '2026-11-03T12:00:00Z',
    decisions: [],
    allowed_actions: ['read'],
    activity_version: 8,
  }
  const returned = {
    ...active,
    id: 'zero-returned',
    reason: 'Ancienne déclaration.',
    state: 'returned',
  }
  const emptyList = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  const fetch = vi.fn((url) => {
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
    if (path.includes('/zero-spending-declarations?cursor=older'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: [returned],
            next: null,
            previous:
              '/api/v1/activities/activity-1/zero-spending-declarations?cursor=newer',
          }),
        ),
      )
    if (path.endsWith('/zero-spending-declarations'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: [active],
            next: '/api/v1/activities/activity-1/zero-spending-declarations?cursor=older',
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(current)))
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(new Response(JSON.stringify(emptyList)))
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: [
            '/execution/activities/activity-1?zeroSpendingCursor=older',
          ],
        }),
      )}
    />,
  )
  expect(
    await screen.findByText(
      'La déclaration en cours se trouve sur une page plus récente.',
    ),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Soumettre la déclaration' }),
  ).toBeNull()
  await user.click(screen.getByText('Déclarations retournées'))
  expect(
    screen.getByText('Retournée pour correction · Ancienne déclaration.'),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Revenir à la déclaration en cours' }),
  )
  expect(await screen.findByText('Motif : Déclaration active.')).toBeVisible()
})

test.each(['AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'])(
  '%s sees closed evidence without closure controls',
  async (role) => {
    const current = {
      ...detail({ started: true, completed: true }),
      state: 'closed',
      version: 12,
      closure: {
        closed_by_id: 'agent',
        closed_at: '2026-10-30T15:00:00Z',
      },
      closure_blockers: [],
      allowed_actions: ['read'],
    }
    const emptyList = {
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }
    const fetch = vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: { id: 'reviewer', role },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return Promise.resolve(new Response(JSON.stringify(current)))
      if (
        path.endsWith('/execution/history') ||
        path.endsWith('/disbursement-requests') ||
        path.endsWith('/virement-requests')
      )
        return Promise.resolve(new Response(JSON.stringify(emptyList)))
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
    expect(await screen.findByText('Activité clôturée')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Clôturer l’activité' }),
    ).toBeNull()
  },
)

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
    if (path.endsWith('/virement-requests'))
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
    if (path.endsWith('/virement-requests'))
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

test.each([
  ['décaissement', '/disbursement-requests', /Soumettre 100.*000 XOF/],
  ['virement', '/virement-requests', /Demander le virement de 100.*000 XOF/],
])(
  'offline invalidation aborts and clears a pending %s mutation',
  async (_label, mutationPath, buttonName) => {
    const user = userEvent.setup()
    let mutationSignal
    const execution = detail({ started: true, completed: true })
    if (mutationPath === '/virement-requests')
      execution.virement_context = {
        disbursement_request_id: '33333333-3333-4333-8333-333333333333',
        amount: '100000',
        current_request_id: null,
        current_state: null,
        can_submit: true,
        unavailable_reason: null,
        confirmation_revision: null,
      }
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
      if (path.endsWith(mutationPath) && options.method === 'POST') {
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
      if (path.endsWith('/virement-requests'))
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
        return Promise.resolve(new Response(JSON.stringify(execution)))
      return Promise.resolve(new Response('{}', { status: 404 }))
    })
    vi.stubGlobal('fetch', fetch)
    const router = makeRouter(
      createMemoryHistory({
        initialEntries: ['/execution/activities/activity-1'],
      }),
    )
    render(<App router={router} />)
    await user.click(await screen.findByRole('button', { name: buttonName }))
    await waitFor(() => expect(mutationSignal).toBeDefined())
    window.dispatchEvent(new Event('offline'))
    expect(await screen.findByText(/Reconnectez-vous/)).toBeVisible()
    await waitFor(() => expect(mutationSignal.aborted).toBe(true))
    expect(
      router.options.context.queryClient.getMutationCache().getAll(),
    ).toEqual([])
    window.dispatchEvent(new Event('online'))
  },
)

test('Agent submits the locked disbursement amount for virement authorization', async () => {
  const user = userEvent.setup()
  const sourceId = '33333333-3333-4333-8333-333333333333'
  const requestId = '44444444-4444-4444-8444-444444444444'
  let virement = null
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    disbursement_request_id: sourceId,
    amount: '100000',
    current_request_id: null,
    current_state: null,
    can_submit: true,
    unavailable_reason: null,
  }
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
            count: 1,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/virement-requests') && options.method === 'POST') {
      virement = {
        id: requestId,
        activity_id: 'activity-1',
        disbursement_request_id: sourceId,
        approved_revision_id: execution.approved_revision_id,
        amount: '100000',
        state: 'submitted',
        submitter_id: 'agent',
        submitted_at: new Date().toISOString(),
        cancellation: null,
        decisions: [],
        allowed_actions: ['read', 'cancel'],
        activity_version: 8,
      }
      execution.version = 8
      execution.virement_context = {
        ...execution.virement_context,
        current_request_id: requestId,
        current_state: 'submitted',
        can_submit: false,
        unavailable_reason: 'virement_exists',
      }
      return Promise.resolve(new Response(JSON.stringify(virement)))
    }
    if (path.endsWith(`/virement-requests/${requestId}`))
      return Promise.resolve(new Response(JSON.stringify(virement)))
    if (path.endsWith('/virement-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: virement ? 1 : 0,
            data: virement ? [virement] : [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(execution)))
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
      name: /Demander le virement de 100.*000 XOF/,
    }),
  )
  expect(
    (await screen.findAllByText('Soumise au Superviseur'))[0],
  ).toBeVisible()
  expect(
    screen.getByText(/ne confirme pas qu’un virement externe/i),
  ).toBeVisible()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/virement-requests',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 7,
        expected_disbursement_request_id: sourceId,
      }),
    }),
  )
})

test('Agent declares the fixed approved virement amount without retyping it', async () => {
  const user = userEvent.setup()
  const requestId = '44444444-4444-4444-8444-444444444444'
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    disbursement_request_id: '33333333-3333-4333-8333-333333333333',
    amount: '100000',
    current_request_id: requestId,
    current_state: 'approved',
    can_submit: false,
    unavailable_reason: 'virement_exists',
    confirmation_revision: null,
  }
  let virement = {
    id: requestId,
    activity_id: 'activity-1',
    amount: '100000',
    state: 'approved',
    decisions: [],
    cancellation: null,
    allowed_actions: ['read', 'declare_confirmation'],
    current_confirmation: null,
    activity_version: 7,
  }
  let confirmations = []
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
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
    if (
      path.endsWith(
        `/virement-requests/${requestId}/confirmation/corrections`,
      ) &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      const revision = confirmations.length + 1
      const corrected = {
        id: `confirmation-${revision}`,
        revision,
        amount: '100000',
        transfer_date: body.transfer_date,
        note: body.note,
        actor_id: 'agent',
        recorded_at: `2026-10-29T1${revision}:00:00Z`,
        correction_reason: body.reason,
      }
      confirmations = [corrected, ...confirmations]
      virement = {
        ...virement,
        current_confirmation: corrected,
        activity_version: 7 + revision,
      }
      execution.version = 7 + revision
      return Promise.resolve(new Response(JSON.stringify(corrected)))
    }
    if (
      path.endsWith(`/virement-requests/${requestId}/confirmation`) &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      const declared = {
        id: 'confirmation-1',
        revision: 1,
        amount: '100000',
        transfer_date: body.transfer_date,
        note: body.note,
        actor_id: 'agent',
        recorded_at: '2026-10-29T10:00:00Z',
        correction_reason: null,
      }
      confirmations = [declared]
      virement = {
        ...virement,
        current_confirmation: declared,
        allowed_actions: ['read', 'correct_confirmation'],
        activity_version: 8,
      }
      execution.version = 8
      return Promise.resolve(
        new Response(JSON.stringify(virement.current_confirmation)),
      )
    }
    if (path.endsWith(`/virement-requests/${requestId}/confirmation/history`))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...empty,
            count: confirmations.length,
            data: confirmations,
          }),
        ),
      )
    if (path.endsWith(`/virement-requests/${requestId}`))
      return Promise.resolve(new Response(JSON.stringify(virement)))
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(execution)))
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(new Response(JSON.stringify(empty)))
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
    await screen.findByText(/MJL enregistre la déclaration/i),
  ).toBeVisible()
  await user.type(
    screen.getByLabelText('Date effective du virement'),
    '2026-10-28',
  )
  await user.type(screen.getByLabelText(/Référence ou commentaire/), 'TEST-001')
  await user.click(screen.getByLabelText(/Je confirme que ce montant/))
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer la déclaration' }),
  )
  expect(fetch).toHaveBeenCalledWith(
    `/api/v1/activities/activity-1/virement-requests/${requestId}/confirmation`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 7,
        transfer_date: '2026-10-28',
        note: 'TEST-001',
      }),
    }),
  )
  await screen.findByRole('button', { name: 'Corriger la déclaration' })
  const virementSection = screen
    .getByRole('heading', { name: 'Autorisation de virement' })
    .closest('section')
  const virementPanel = within(virementSection)
  await user.clear(virementPanel.getByLabelText('Date effective du virement'))
  await user.type(
    virementPanel.getByLabelText('Date effective du virement'),
    '2026-10-27',
  )
  await user.clear(virementPanel.getByLabelText(/Référence ou commentaire/))
  await user.type(
    virementPanel.getByLabelText(/Référence ou commentaire/),
    'TEST-002',
  )
  await user.type(
    virementPanel.getByLabelText('Motif de la correction'),
    'Première correction.',
  )
  await user.click(virementPanel.getByLabelText(/Je confirme que ce montant/))
  await user.click(
    virementPanel.getByRole('button', { name: 'Corriger la déclaration' }),
  )
  await waitFor(() =>
    expect(virementPanel.getByLabelText('Motif de la correction')).toHaveValue(
      '',
    ),
  )
  expect(
    virementPanel.getByLabelText('Date effective du virement'),
  ).toHaveValue('2026-10-27')
  await user.type(
    virementPanel.getByLabelText('Motif de la correction'),
    'Deuxième correction.',
  )
  await user.clear(virementPanel.getByLabelText(/Référence ou commentaire/))
  await user.type(
    virementPanel.getByLabelText(/Référence ou commentaire/),
    'TEST-003',
  )
  await user.click(virementPanel.getByLabelText(/Je confirme que ce montant/))
  await user.click(
    virementPanel.getByRole('button', { name: 'Corriger la déclaration' }),
  )
  await waitFor(() =>
    expect(
      virementPanel.getByLabelText(/Référence ou commentaire/),
    ).toHaveValue('TEST-003'),
  )
})

test('Agent records the exact reversement and preserves reasoned corrections', async () => {
  const user = userEvent.setup()
  const requestId = '44444444-4444-4444-8444-444444444444'
  const execution = detail({ started: true, completed: true })
  execution.approved_allocation = '300000'
  execution.spending_total = '200000'
  execution.virement_context = {
    disbursement_request_id: '33333333-3333-4333-8333-333333333333',
    amount: '200000',
    current_request_id: requestId,
    current_state: 'approved',
    can_submit: false,
    unavailable_reason: 'virement_exists',
  }
  const confirmation = {
    id: 'confirmation-1',
    revision: 1,
    amount: '200000',
    transfer_date: '2026-10-27',
    note: 'VIREMENT-001',
    actor_id: 'agent',
    recorded_at: '2026-10-27T10:00:00Z',
    correction_reason: null,
  }
  let declarations = []
  let virement = {
    id: requestId,
    activity_id: 'activity-1',
    amount: '200000',
    state: 'approved',
    decisions: [],
    cancellation: null,
    allowed_actions: ['read', 'correct_confirmation'],
    current_confirmation: confirmation,
    reversement: {
      required_amount: '100000',
      declared_amount: '0',
      status: 'required',
      current_declaration: null,
      allowed_actions: ['read', 'declare'],
    },
    activity_version: 8,
  }
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
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
    if (
      path.endsWith(`/virement-requests/${requestId}/reversement`) &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      const declared = {
        id: 'reversement-1',
        revision: 1,
        returned_amount: '100000',
        return_date: body.return_date,
        note: body.note,
        actor_id: 'agent',
        recorded_at: '2026-10-28T10:00:00Z',
        correction_reason: null,
        activity_version: 9,
      }
      declarations = [declared]
      virement = {
        ...virement,
        activity_version: 9,
        allowed_actions: ['read'],
        reversement: {
          ...virement.reversement,
          declared_amount: '100000',
          status: 'declared',
          current_declaration: declared,
          allowed_actions: ['read', 'correct'],
        },
      }
      execution.version = 9
      return Promise.resolve(new Response(JSON.stringify(declared)))
    }
    if (
      path.endsWith(
        `/virement-requests/${requestId}/reversement/corrections`,
      ) &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      const corrected = {
        ...declarations[0],
        id: 'reversement-2',
        revision: 2,
        return_date: body.return_date,
        note: body.note,
        correction_reason: body.reason,
        recorded_at: '2026-10-29T10:00:00Z',
        activity_version: 10,
      }
      declarations = [corrected, ...declarations]
      virement = {
        ...virement,
        activity_version: 10,
        reversement: {
          ...virement.reversement,
          current_declaration: corrected,
        },
      }
      execution.version = 10
      return Promise.resolve(new Response(JSON.stringify(corrected)))
    }
    if (path.endsWith(`/virement-requests/${requestId}/reversement/history`))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...empty,
            count: declarations.length,
            data: declarations,
          }),
        ),
      )
    if (path.endsWith(`/virement-requests/${requestId}/confirmation/history`))
      return Promise.resolve(new Response(JSON.stringify(empty)))
    if (path.endsWith(`/virement-requests/${requestId}`))
      return Promise.resolve(new Response(JSON.stringify(virement)))
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(execution)))
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(new Response(JSON.stringify(empty)))
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

  const title = await screen.findByRole('heading', {
    name: 'Reversement au Partenaire',
  })
  const panel = within(title.closest('section'))
  expect(panel.getByText('100 000 XOF', { exact: true })).toBeVisible()
  await user.type(
    panel.getByLabelText('Date effective du reversement'),
    '2026-10-28',
  )
  await user.type(
    panel.getByLabelText(/Référence ou commentaire du reversement/),
    'REVERSEMENT-001',
  )
  await user.click(panel.getByLabelText(/montant exact a été reversé/))
  await user.click(
    panel.getByRole('button', { name: 'Enregistrer le reversement' }),
  )
  expect(fetch).toHaveBeenCalledWith(
    `/api/v1/activities/activity-1/virement-requests/${requestId}/reversement`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 8,
        return_date: '2026-10-28',
        note: 'REVERSEMENT-001',
      }),
    }),
  )
  await screen.findByRole('button', { name: 'Corriger le reversement' })
  await user.clear(panel.getByLabelText('Date effective du reversement'))
  await user.type(
    panel.getByLabelText('Date effective du reversement'),
    '2026-10-29',
  )
  await user.type(
    panel.getByLabelText('Motif de la correction du reversement'),
    'Date corrigée.',
  )
  await user.click(panel.getByLabelText(/montant exact a été reversé/))
  await user.click(
    panel.getByRole('button', { name: 'Corriger le reversement' }),
  )
  await waitFor(() =>
    expect(panel.getByLabelText('Date effective du reversement')).toHaveValue(
      '2026-10-29',
    ),
  )
})

test('zero reversement displays settlement without a declaration form', async () => {
  const requestId = '44444444-4444-4444-8444-444444444444'
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    disbursement_request_id: '33333333-3333-4333-8333-333333333333',
    amount: '100000',
    current_request_id: requestId,
    current_state: 'approved',
    can_submit: false,
    unavailable_reason: 'virement_exists',
  }
  const virement = {
    id: requestId,
    amount: '100000',
    state: 'approved',
    decisions: [],
    cancellation: null,
    allowed_actions: ['read', 'correct_confirmation'],
    current_confirmation: {
      id: 'confirmation-1',
      revision: 1,
      amount: '100000',
      transfer_date: '2026-10-27',
      note: null,
      actor_id: 'agent',
      recorded_at: '2026-10-27T10:00:00Z',
      correction_reason: null,
    },
    reversement: {
      required_amount: '0',
      declared_amount: '0',
      status: 'not_required',
      current_declaration: null,
      allowed_actions: ['read'],
    },
    activity_version: 8,
  }
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  vi.stubGlobal('fetch', (url) => {
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
    if (path.endsWith(`/virement-requests/${requestId}`))
      return Promise.resolve(new Response(JSON.stringify(virement)))
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(execution)))
    return Promise.resolve(new Response(JSON.stringify(empty)))
  })
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  expect(await screen.findByText('Aucun reversement requis.')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Enregistrer le reversement' }),
  ).not.toBeInTheDocument()
})

test('an uncertain virement submission stays blocked until reconciliation succeeds', async () => {
  const user = userEvent.setup()
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    disbursement_request_id: '33333333-3333-4333-8333-333333333333',
    amount: '100000',
    current_request_id: null,
    current_state: null,
    can_submit: true,
    unavailable_reason: null,
  }
  let executionCalls = 0
  let finishReconciliation
  const list = new Response(
    JSON.stringify({
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }),
  )
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
    if (path.endsWith('/virement-requests') && options.method === 'POST')
      return Promise.reject(new TypeError('Synthetic uncertain response'))
    if (path.endsWith('/activities/activity-1/execution')) {
      executionCalls += 1
      if (executionCalls === 1)
        return Promise.resolve(new Response(JSON.stringify(execution)))
      return new Promise((resolve) => {
        finishReconciliation = () =>
          resolve(new Response(JSON.stringify(execution)))
      })
    }
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(list.clone())
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
  const submit = await screen.findByRole('button', {
    name: /Demander le virement de 100.*000 XOF/,
  })
  await user.click(submit)
  await waitFor(() => expect(finishReconciliation).toBeDefined())
  expect(submit).toBeDisabled()
  finishReconciliation()
  await waitFor(() => expect(submit).toBeEnabled())
})

test('realization cursors reject foreign and malformed links', () => {
  expect(
    cursorFrom(
      'http://localhost:3000/api/v1/activities/activity-1/virement-requests?cursor=next',
      '/activities/activity-1/virement-requests',
    ),
  ).toBe('next')
  expect(
    cursorFrom(
      'https://example.test/api/v1/activities/activity-1/virement-requests?cursor=forged',
      '/activities/activity-1/virement-requests',
    ),
  ).toBe('')
  expect(
    cursorFrom('not a valid URL', '/activities/activity-1/virement-requests'),
  ).toBe('')
})
