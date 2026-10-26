import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { App, makeRouter } from './router'
import { ActivityForm } from './PlanningView'
import { addThreeMonths, formatXof } from './planning'

afterEach(() => {
  toast.dismiss()
  window.dispatchEvent(new Event('online'))
  vi.unstubAllGlobals()
})

test.each([
  ['2027-01-31', '2027-04-30'],
  ['2027-02-28', '2027-05-28'],
  ['2027-08-31', '2027-11-30'],
  ['2026-11-30', '2027-02-28'],
  ['2027-11-30', '2028-02-29'],
])(
  'adds three calendar months to %s without timezone arithmetic',
  (start, end) => {
    expect(addThreeMonths(start)).toBe(end)
  },
)

test('formats an exact integer amount in XOF', () => {
  expect(formatXof('1250000')).toContain('1')
  expect(formatXof('1250000')).toContain('XOF')
})

test('an eligible Agent confirms submission of the current Activity version', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  const activity = {
    id: 'activity-1',
    pta_id: 'pta-1',
    reference: 'ACT-000001',
    name: 'Atelier',
    description: 'Préparation de l’atelier',
    planned_start: '2027-01-10',
    planned_end: '2027-04-10',
    allocation: '100000',
    state: 'draft',
    version: 1,
    current_revision_id: null,
    approved_revision_id: null,
    approved_allocation: null,
    operations: [
      {
        id: 'operation-1',
        type_id: 'type-1',
        name: 'Préparer',
        allocation: '100000',
        position: 1,
      },
    ],
    agent_ids: [],
    allowed_actions: ['read', 'edit', 'submit'],
  }
  const fetch = vi.fn((url, options = {}) => {
    if (url.includes('/auth/session'))
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
    if (options.method === 'POST')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'revision-1',
            revision_number: 1,
            activity_version: 2,
          }),
          { status: 201 },
        ),
      )
    if (url.endsWith('/activities/activity-1'))
      return Promise.resolve(new Response(JSON.stringify(activity)))
    if (url.includes('/activities/activity-1/revisions'))
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
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/activities/activity-1'] }),
      )}
    />,
  )
  await user.click(
    await screen.findByRole('button', { name: 'Soumettre pour prévalidation' }),
  )
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/submissions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expected_version: 1 }),
      }),
    ),
  )
})

test('an Agent opens and cancels an amendment while the approved version stays visible', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  const approved = {
    name: 'Atelier approuvé',
    description: 'Version approuvée',
    planned_start: '2027-01-10',
    planned_end: '2027-04-10',
    allocation: '100000',
    operations: [
      {
        id: 'operation-1',
        type_id: 'type-1',
        name: 'Préparer',
        allocation: '100000',
        position: 1,
      },
    ],
  }
  let activity = {
    id: 'activity-1',
    pta_id: 'pta-1',
    reference: 'ACT-000001',
    ...approved,
    state: 'approved',
    version: 4,
    current_revision_id: 'revision-1',
    approved_revision_id: 'revision-1',
    approved_allocation: '100000',
    approved,
    candidate: null,
    amendment: null,
    execution_paused: false,
    operations: approved.operations,
    correction: null,
    agent_ids: [],
    allowed_actions: ['read', 'open_amendment'],
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
      path.endsWith('/activities/activity-1/amendments') &&
      options.method === 'POST'
    ) {
      activity = {
        ...activity,
        state: 'amendment_draft',
        version: 5,
        amendment: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          reason: 'Adapter.',
        },
        candidate: { ...approved, description: 'Version candidate' },
        execution_paused: true,
        allowed_actions: ['read', 'edit', 'submit', 'cancel_amendment'],
      }
      return Promise.resolve(
        new Response(JSON.stringify(activity), { status: 201 }),
      )
    }
    if (path.includes('/cancellation') && options.method === 'POST') {
      activity = {
        ...activity,
        state: 'approved',
        version: 6,
        amendment: null,
        candidate: null,
        execution_paused: false,
        allowed_actions: ['read', 'open_amendment'],
      }
      return Promise.resolve(new Response(JSON.stringify(activity)))
    }
    if (path.endsWith('/activities/activity-1'))
      return Promise.resolve(new Response(JSON.stringify(activity)))
    if (path.includes('/activities/activity-1/revisions'))
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
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/activities/activity-1'] }),
      )}
    />,
  )
  await user.click(
    await screen.findByRole('button', { name: 'Demander une modification' }),
  )
  await user.type(screen.getByLabelText('Motif de la modification'), 'Adapter.')
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  expect(
    await screen.findByText(/exécution de cette activité est suspendue/i),
  ).toBeVisible()
  expect(
    screen.getByRole('region', { name: 'Version approuvée' }),
  ).toBeVisible()
  expect(
    screen.getByRole('region', { name: 'Modification en préparation' }),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Annuler la modification' }),
  )
  await user.type(
    screen.getByLabelText('Motif de l’annulation'),
    'Retour au socle.',
  )
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  await waitFor(() =>
    expect(
      screen.queryByText(/exécution de cette activité est suspendue/i),
    ).not.toBeInTheDocument(),
  )
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/amendments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cancellation',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 5,
        expected_approved_revision_id: 'revision-1',
        reason: 'Retour au socle.',
      }),
    }),
  )
})

function amendmentHistoryFetch({ failed = false } = {}) {
  const activity = {
    id: 'activity-1',
    pta_id: 'pta-1',
    reference: 'ACT-000001',
    name: 'Activité courante',
    description: 'Description courante',
    planned_start: '2027-01-10',
    planned_end: '2027-04-10',
    allocation: '100000',
    state: 'approved',
    version: 8,
    current_revision_id: 'revision-2',
    approved_revision_id: 'revision-2',
    approved_allocation: '100000',
    approved: null,
    candidate: null,
    amendment: null,
    execution_paused: false,
    operations: [],
    correction: null,
    agent_ids: [],
    allowed_actions: ['read', 'open_amendment'],
  }
  return vi.fn((url) => {
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
    if (path.includes('/amendments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))
      return Promise.resolve(
        failed
          ? new Response(JSON.stringify({ detail: 'unavailable' }), {
              status: 503,
            })
          : new Response(
              JSON.stringify({
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                activity_id: 'activity-1',
                status: 'approved',
                reason: 'Ajustement approuvé',
                base_approved_revision_id: 'revision-1',
                opened_by_id: 'agent-1',
                opened_at: '2027-03-01T09:00:00Z',
                last_revision_id: 'revision-2',
                cancellation: null,
                candidate: {
                  name: 'Nouveau nom approuvé',
                  description: 'Version historique',
                  planned_start: '2027-01-10',
                  planned_end: '2027-04-10',
                  allocation: '100000',
                  operations: [
                    {
                      id: 'operation-1',
                      type_id: 'type-1',
                      type_label: 'Formation figée',
                      name: 'Former',
                      allocation: '100000',
                      position: 1,
                    },
                  ],
                },
              }),
            ),
      )
    if (path.endsWith('/activities/activity-1'))
      return Promise.resolve(new Response(JSON.stringify(activity)))
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
  })
}

test('approved amendment history renders frozen names, labels, and actor evidence', async () => {
  vi.stubGlobal('fetch', amendmentHistoryFetch())
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: [
            '/activities/activity-1?amendment=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ],
        }),
      )}
    />,
  )
  expect(await screen.findByText('Modification approuvée')).toBeVisible()
  expect(screen.getByText('Nouveau nom approuvé')).toBeVisible()
  expect(screen.getByText(/Formation figée — Former/)).toBeVisible()
  expect(screen.getByText(/Ouverte par agent-1/)).toBeVisible()
})

test('a failed amendment-history request blocks the workspace with an alert', async () => {
  vi.stubGlobal('fetch', amendmentHistoryFetch({ failed: true }))
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: [
            '/activities/activity-1?amendment=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ],
        }),
      )}
    />,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Les données de planification sont indisponibles.',
  )
})

test('a new Activity keeps its request key across a lost-response retry', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <ActivityForm
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onSubmit={submit}
    />,
  )
  await user.type(screen.getByLabelText('Nom', { exact: true }), 'Activité')
  await user.type(screen.getByLabelText('Description'), 'Description')
  await user.type(screen.getByLabelText('Début'), '2027-01-31')
  expect(screen.getByLabelText('Fin')).toHaveValue('2027-04-30')
  await user.clear(screen.getByLabelText('Fin'))
  await user.type(screen.getByLabelText('Fin'), '2027-05-15')
  await user.clear(screen.getByLabelText('Début'))
  await user.type(screen.getByLabelText('Début'), '2027-02-28')
  expect(screen.getByLabelText('Fin')).toHaveValue('2027-05-15')
  await user.selectOptions(
    screen.getByLabelText('Type d’opération 1'),
    'type-1',
  )
  await user.type(screen.getByLabelText('Nom de l’opération 1'), 'Préparer')
  await user.type(screen.getByLabelText('Budget de l’opération 1'), '10')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(submit).toHaveBeenCalledTimes(2)
  expect(submit.mock.calls[0][0].request_key).toBe(
    submit.mock.calls[1][0].request_key,
  )
})

test('an Agent sees the empty projects workspace', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('/auth/')
              ? {
                  state: 'verified',
                  csrf: 'fixture',
                  user: {
                    id: 'agent',
                    email: 'agent@example.test',
                    role: 'AGENT_SAISIE',
                  },
                  expires_at: new Date(Date.now() + 60000).toISOString(),
                }
              : {
                  object: 'list',
                  count: 0,
                  data: [],
                  next: null,
                  previous: null,
                },
          ),
        ),
      ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/projects'] }),
      )}
    />,
  )
  expect(
    await screen.findByRole('heading', { name: 'Projets', level: 1 }),
  ).toBeVisible()
  expect(screen.getByText('Aucun projet.')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Créer' }),
  ).not.toBeInTheDocument()
})

test('the technical Admin cannot see planning records', async () => {
  const fetch = vi.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          state: 'verified',
          csrf: 'fixture',
          user: { id: 'admin', role: 'ADMIN_PLATEFORME' },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        }),
      ),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/projects'] }),
      )}
    />,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('rôles métier')
  expect(fetch.mock.calls.every(([url]) => url.includes('/auth/'))).toBe(true)
})

test('Validator creation uses a modal dialog and returns focus on Escape', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('/auth/')
              ? {
                  state: 'verified',
                  csrf: 'fixture',
                  user: { id: 'validator', role: 'VALIDATEUR_DEFINITIF' },
                  expires_at: new Date(Date.now() + 60000).toISOString(),
                }
              : {
                  object: 'list',
                  count: 0,
                  data: [],
                  next: null,
                  previous: null,
                },
          ),
        ),
      ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/partners'] }),
      )}
    />,
  )
  const heading = await screen.findByRole('heading', {
    name: 'Partenaires',
    level: 2,
  })
  const opener = within(heading.closest('.planning-card')).getByRole('button', {
    name: 'Ajouter',
  })
  await user.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Ajouter — Partenaires' })
  expect(dialog).toHaveAttribute('open')
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(dialog).not.toHaveAttribute('open')
  expect(opener).toHaveFocus()
})

test('authentication loss aborts an in-flight planning mutation and masks it', async () => {
  const user = userEvent.setup()
  let mutationSignal
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options = {}) => {
      if (url.includes('/auth/'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: { id: 'validator', role: 'VALIDATEUR_DEFINITIF' },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (options.method === 'POST') {
        mutationSignal = options.signal
        return new Promise((_resolve, reject) =>
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        )
      }
      const data = url.endsWith('/partners')
        ? [
            {
              id: 'partner-1',
              name: 'Partenaire',
              active: true,
              allowed_actions: [],
            },
          ]
        : []
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: data.length,
            data,
            next: null,
            previous: null,
          }),
        ),
      )
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/projects'] }),
      )}
    />,
  )
  const opener = await screen.findByRole('button', { name: 'Créer' })
  await user.click(opener)
  await user.type(screen.getByLabelText('Nom'), 'Projet retardé')
  await user.click(screen.getByRole('dialog').getElementsByTagName('button')[0])
  window.dispatchEvent(new Event('offline'))
  expect(
    await screen.findByRole('heading', { name: 'Accès à vérifier' }),
  ).toBeVisible()
  expect(mutationSignal.aborted).toBe(true)
  expect(
    screen.queryByText('Modifications enregistrées.'),
  ).not.toBeInTheDocument()
})

test('a planning mutation invalidates and visibly refreshes the cached list', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  let partnerReads = 0
  let created = false
  const requestUrls = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options = {}) => {
      requestUrls.push(String(url))
      if (url.includes('/auth/'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: { id: 'validator', role: 'VALIDATEUR_DEFINITIF' },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (
        String(url).includes('/api/v1/partners') &&
        options.method === 'POST'
      ) {
        created = true
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'partner-1' }), { status: 201 }),
        )
      }
      let data = []
      if (String(url).includes('/api/v1/partners')) {
        partnerReads += 1
        if (created)
          data = [
            {
              id: 'partner-1',
              name: 'Partenaire actualisé',
              active: true,
              allowed_actions: ['read'],
            },
          ]
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: data.length,
            data,
            next: null,
            previous: null,
          }),
        ),
      )
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/partners'] }),
      )}
    />,
  )
  const heading = await screen.findByRole('heading', {
    name: 'Partenaires',
    level: 2,
  })
  expect(requestUrls.join('|')).toContain('/api/v1/partners')
  const card = heading.closest('.planning-card')
  await user.click(within(card).getByRole('button', { name: 'Ajouter' }))
  const dialog = within(card).getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), 'Partenaire actualisé')
  await user.click(within(dialog).getByRole('button', { name: 'Ajouter' }))
  await waitFor(() => expect(partnerReads).toBeGreaterThanOrEqual(2))
  expect(await within(card).findByText('Partenaire actualisé')).toBeVisible()
})

test('a 409 planning mutation refetches server state before another action', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  let partnerReads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options = {}) => {
      if (url.includes('/auth/'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: { id: 'validator', role: 'VALIDATEUR_DEFINITIF' },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (options.method === 'POST')
        return Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'activity_stale',
              message: 'Version obsolète.',
            }),
            { status: 409 },
          ),
        )
      if (String(url).includes('/api/v1/partners')) partnerReads += 1
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
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/partners'] }),
      )}
    />,
  )
  const heading = await screen.findByRole('heading', {
    name: 'Partenaires',
    level: 2,
  })
  const card = heading.closest('.planning-card')
  await user.click(within(card).getByRole('button', { name: 'Ajouter' }))
  const dialog = within(card).getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), 'Conflit')
  await user.click(within(dialog).getByRole('button', { name: 'Ajouter' }))
  await waitFor(() => expect(partnerReads).toBeGreaterThanOrEqual(2))
  expect(screen.getByRole('alert')).toBeVisible()
})

test('a delayed planning result cannot repopulate content after access denial', async () => {
  let releasePartners
  let reportPartnerRequest
  const partnerRequested = new Promise((resolve) => {
    reportPartnerRequest = resolve
  })
  const delayedPartners = new Promise((resolve) => {
    releasePartners = resolve
  })
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (url.includes('/auth/'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: { id: 'agent', role: 'AGENT_SAISIE' },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (String(url).includes('/api/v1/partners')) {
        reportPartnerRequest()
        return delayedPartners
      }
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
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/partners'] }),
      )}
    />,
  )
  await partnerRequested
  window.dispatchEvent(new Event('offline'))
  expect(
    await screen.findByRole('heading', { name: 'Accès à vérifier' }),
  ).toBeVisible()
  await act(async () => {
    releasePartners(
      new Response(
        JSON.stringify({
          object: 'list',
          count: 1,
          data: [
            {
              id: 'secret',
              name: 'Partenaire retardé',
              active: true,
              allowed_actions: [],
            },
          ],
          next: null,
          previous: null,
        }),
      ),
    )
  })
  await waitFor(() =>
    expect(screen.queryByText('Partenaire retardé')).not.toBeInTheDocument(),
  )
})

test.each(['success', 'failure'])(
  'an uncertain workflow response stays blocked through %s reconciliation',
  async (refetchOutcome) => {
    const user = userEvent.setup()
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
    let committed = false
    let activityReads = 0
    let submissionCalls = 0
    let resolveActivityRefetch
    const activityRefetch = new Promise((resolve) => {
      resolveActivityRefetch = resolve
    })
    const draft = {
      id: 'activity-uncertain',
      pta_id: 'pta-1',
      reference: 'ACT-000099',
      name: 'Activité à réconcilier',
      description: 'Réponse réseau perdue',
      planned_start: '2027-01-10',
      planned_end: '2027-04-10',
      allocation: '100000',
      state: 'draft',
      version: 1,
      current_revision_id: null,
      approved_revision_id: null,
      approved_allocation: null,
      operations: [
        {
          id: 'operation-1',
          type_id: 'type-1',
          name: 'Préparer',
          allocation: '100000',
          position: 1,
        },
      ],
      agent_ids: [],
      allowed_actions: ['read', 'edit', 'submit'],
    }
    const revision = {
      id: 'revision-uncertain',
      revision_number: 1,
      activity_version: 2,
      submitted_at: '2027-01-02T10:00:00Z',
      decisions: [],
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
      if (path.endsWith('/activities/activity-uncertain/submissions')) {
        submissionCalls += 1
        committed = true
        return Promise.reject(new TypeError('lost response'))
      }
      if (path.endsWith('/activities/activity-uncertain')) {
        activityReads += 1
        if (committed) return activityRefetch
        return Promise.resolve(new Response(JSON.stringify(draft)))
      }
      if (path.endsWith(`/revisions/${revision.id}`))
        return Promise.resolve(new Response(JSON.stringify(revision)))
      if (path.includes('/activities/activity-uncertain/revisions'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: committed ? 1 : 0,
              data: committed ? [revision] : [],
              next: null,
              previous: null,
            }),
          ),
        )
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
    })
    vi.stubGlobal('fetch', fetch)
    render(
      <App
        router={makeRouter(
          createMemoryHistory({
            initialEntries: ['/activities/activity-uncertain'],
          }),
        )}
      />,
    )
    await user.click(
      await screen.findByRole('button', {
        name: 'Soumettre pour prévalidation',
      }),
    )
    await user.click(
      screen.getByRole('dialog').querySelector('button[type="submit"]'),
    )
    await waitFor(() => expect(submissionCalls).toBe(1))
    expect(
      screen.getByRole('button', { name: 'Soumettre pour prévalidation' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('dialog').querySelector('button[type="submit"]'),
    ).toBeDisabled()
    await act(async () => {
      resolveActivityRefetch(
        refetchOutcome === 'success'
          ? new Response(
              JSON.stringify({
                ...draft,
                state: 'submitted',
                version: 2,
                current_revision_id: revision.id,
                allowed_actions: ['read'],
              }),
            )
          : new Response(JSON.stringify({ code: 'service_unavailable' }), {
              status: 503,
            }),
      )
    })
    expect(activityReads).toBeGreaterThanOrEqual(2)
    expect(submissionCalls).toBe(1)
    if (refetchOutcome === 'success') {
      expect(
        await screen.findByText('Soumise pour prévalidation'),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'Soumettre pour prévalidation' }),
      ).not.toBeInTheDocument()
    } else {
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Les données de planification sont indisponibles.',
      )
      expect(
        screen.queryByRole('button', { name: 'Soumettre pour prévalidation' }),
      ).not.toBeInTheDocument()
    }
  },
)
