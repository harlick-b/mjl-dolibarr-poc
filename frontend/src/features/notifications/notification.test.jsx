import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router'

const nativeShowModal = HTMLDialogElement.prototype.showModal
const nativeClose = HTMLDialogElement.prototype.close

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (nativeShowModal) HTMLDialogElement.prototype.showModal = nativeShowModal
  else delete HTMLDialogElement.prototype.showModal
  if (nativeClose) HTMLDialogElement.prototype.close = nativeClose
  else delete HTMLDialogElement.prototype.close
})

function verifiedSession(role = 'AGENT_SAISIE') {
  return {
    state: 'verified',
    csrf: 'csrf',
    user: { id: 'agent', email: 'user@example.test', role },
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  }
}

function notification(overrides = {}) {
  return {
    kind: 'financial_review',
    stage: 'supervisor',
    request_kind: 'virement',
    request_id: 'request-1',
    id: 'notice-1',
    activity_id: 'activity-1',
    activity_reference: 'ACT-001',
    activity_name: 'Formation',
    approved_revision_id: 'revision-1',
    pta_year: 2028,
    created_at: '2028-02-08T09:00:00Z',
    read_at: null,
    handled_at: null,
    email_status: 'delivered',
    version: 1,
    ...overrides,
  }
}

function list(data, count = data.length) {
  return { object: 'list', count, data, next: null, previous: null }
}

function renderWorkspace(fetch) {
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: ['/planning/activities/activity-1'],
        }),
        { planning: () => <p>Espace activité</p> },
      )}
    />,
  )
}

test('the sidebar opens the compact notification inbox and a processed request no longer asks for a decision', async () => {
  const item = notification({
    read_at: '2028-02-08T10:00:00Z',
    handled_at: '2028-02-08T10:30:00Z',
  })
  renderWorkspace(
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(new Response(JSON.stringify(verifiedSession())))
      if (path.includes('state=unread'))
        return Promise.resolve(new Response(JSON.stringify(list([], 0))))
      return Promise.resolve(new Response(JSON.stringify(list([item]))))
    }),
  )

  await userEvent.click(
    await screen.findByRole('button', { name: /^Notifications/ }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Notifications' })

  expect(within(dialog).getByText('Demande déjà traitée')).toBeVisible()
  expect(within(dialog).queryByText('Demande à examiner')).toBeNull()
  expect(
    within(dialog).getByRole('link', { name: 'Consulter l’activité' }),
  ).toHaveAttribute('href', '/execution/activities/activity-1#finance')
  expect(
    within(dialog).queryByRole('button', { name: 'Tout marquer comme lu' }),
  ).toBeNull()
})

test('the Notifications modal uses a spinner while its content loads', async () => {
  renderWorkspace(
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(new Response(JSON.stringify(verifiedSession())))
      if (path.includes('state=unread'))
        return Promise.resolve(new Response(JSON.stringify(list([], 0))))
      return new Promise(() => {})
    }),
  )

  await userEvent.click(
    await screen.findByRole('button', { name: 'Notifications' }),
  )
  const loading = within(
    screen.getByRole('dialog', { name: 'Notifications' }),
  ).getByRole('status', { name: 'Chargement des notifications' })

  expect(loading.querySelector('svg')).toBeInTheDocument()
  expect(
    loading.querySelector('[data-ui="loading-placeholder"]'),
  ).not.toBeInTheDocument()
})

test('Tout marquer comme lu stays hidden while the action is paused', async () => {
  const items = [
    notification(),
    notification({ id: 'notice-2', version: 3, request_id: 'request-2' }),
  ]
  renderWorkspace(
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(new Response(JSON.stringify(verifiedSession())))
      if (path.includes('state=unread'))
        return Promise.resolve(
          new Response(JSON.stringify(list(items.slice(0, 1), items.length))),
        )
      return Promise.resolve(new Response(JSON.stringify(list(items))))
    }),
  )

  expect(
    await screen.findByRole('button', {
      name: 'Notifications, 2 non lues',
    }),
  ).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: /^Notifications/ }))
  const dialog = screen.getByRole('dialog', { name: 'Notifications' })

  expect(
    within(dialog).queryByRole('button', { name: 'Tout marquer comme lu' }),
  ).toBeNull()
})

test('an assignment notification is readable and uses the standard read flow', async () => {
  let read = false
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return Promise.resolve(
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
      )
    if (path.includes('/notifications/') && options.method === 'PATCH') {
      read = true
      return Promise.resolve(
        new Response(
          JSON.stringify({
            kind: 'assignment',
            id: 'notice-1',
            activity_id: 'activity-1',
            activity_reference: 'ACT-001',
            activity_name: 'Formation',
            planned_end: '2028-02-29',
            due_on: '2028-02-08',
            pta_name: 'PTA Protection',
            project_name: 'Protection de l’enfant',
            assigned_by: 'Yoann Validateur',
            created_at: '2028-02-08T08:00:00Z',
            read_at: '2028-02-08T09:00:00Z',
            email_status: 'delivered',
            version: 2,
          }),
        ),
      )
    }
    const data = read
      ? []
      : [
          {
            kind: 'assignment',
            id: 'notice-1',
            activity_id: 'activity-1',
            activity_reference: 'ACT-001',
            activity_name: 'Formation',
            planned_end: '2028-02-29',
            due_on: '2028-02-08',
            pta_name: 'PTA Protection',
            project_name: 'Protection de l’enfant',
            assigned_by: 'Yoann Validateur',
            created_at: '2028-02-08T08:00:00Z',
            read_at: null,
            email_status: 'delivered',
            version: 1,
          },
        ]
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
  })
  renderWorkspace(fetch)
  await userEvent.click(
    await screen.findByRole('button', { name: /^Notifications/ }),
  )

  const item = await screen.findByRole('listitem')
  expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeVisible()
  expect(within(item).getByText('Formation')).toBeVisible()
  expect(item).toHaveTextContent('ACT-001')
  expect(item).toHaveTextContent('Yoann Validateur')
  expect(item).toHaveTextContent('PTA Protection')
  expect(item).toHaveTextContent('Protection de l’enfant')
  expect(
    screen.getByRole('button', { name: 'Notifications, 1 non lues' }),
  ).toBeVisible()
  await userEvent.click(screen.getByRole('link', { name: 'Voir l’activité' }))
  await waitFor(() =>
    expect(screen.queryByText(/ACT-001/)).not.toBeInTheDocument(),
  )
  expect(
    screen.queryByRole('button', { name: /1 non lues/ }),
  ).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/notifications/notice-1',
    expect.objectContaining({ method: 'PATCH' }),
  )
})

test('a Supervisor sees a review notification in the shared inbox', async () => {
  renderWorkspace(
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: {
                id: 'supervisor',
                email: 'supervisor@example.test',
                role: 'AGENT_VERIFICATEUR',
              },
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
                kind: 'activity_review',
                stage: 'supervisor',
                id: 'notice-review-1',
                activity_id: 'activity-1',
                activity_reference: 'ACT-001',
                activity_name: 'Formation',
                approved_revision_id: 'revision-1',
                pta_year: 2028,
                created_at: '2028-02-08T08:00:00Z',
                read_at: null,
                handled_at: null,
                email_status: 'delivered',
                version: 1,
              },
              {
                kind: 'financial_review',
                stage: 'supervisor',
                request_kind: 'virement',
                request_id: 'request-1',
                id: 'notice-financial-1',
                activity_id: 'activity-1',
                activity_reference: 'ACT-001',
                activity_name: 'Formation',
                approved_revision_id: 'revision-1',
                pta_year: 2028,
                created_at: '2028-02-08T09:00:00Z',
                read_at: null,
                handled_at: null,
                email_status: 'delivered',
                version: 1,
              },
            ],
            next: null,
            previous: null,
          }),
        ),
      )
    }),
  )
  await userEvent.click(
    await screen.findByRole('button', { name: /^Notifications/ }),
  )
  expect(await screen.findByText('Activité à examiner')).toBeVisible()
  expect(screen.getByText('Demande à examiner')).toBeVisible()
  expect(
    screen.getByText(/La demande de virement attend votre examen\./),
  ).toBeVisible()
  expect(screen.getAllByText('Formation')).toHaveLength(2)
  expect(
    screen.getByRole('link', { name: 'Voir la réalisation' }),
  ).toHaveAttribute('href', '/execution/activities/activity-1')
  expect(
    screen.getByRole('link', { name: 'Ouvrir la demande' }),
  ).toHaveAttribute('href', '/execution/activities/activity-1#finance')
  expect(
    screen.getByRole('button', { name: 'Notifications, 2 non lues' }),
  ).toBeVisible()
})

test('an approved amendment correction opens directly in Execution', async () => {
  renderWorkspace(
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: {
                id: 'agent',
                email: 'agent@example.test',
                role: 'AGENT_SAISIE',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 1,
            data: [
              {
                kind: 'activity_correction',
                id: 'notice-correction-1',
                activity_id: 'activity-1',
                activity_reference: 'ACT-001',
                activity_name: 'Formation',
                approved_revision_id: 'revision-1',
                pta_year: 2028,
                reason: 'Corriger les dates.',
                created_at: '2028-02-08T08:00:00Z',
                read_at: null,
                handled_at: null,
                email_status: 'delivered',
                version: 1,
              },
            ],
            next: null,
            previous: null,
          }),
        ),
      )
    }),
  )
  await userEvent.click(
    await screen.findByRole('button', { name: /^Notifications/ }),
  )

  expect(
    await screen.findByText('Activité retournée pour correction'),
  ).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Corriger l’activité' }),
  ).toHaveAttribute('href', '/execution/activities/activity-1')
})

test('selecting an already-read notification refreshes a stale sidebar count', async () => {
  let unreadRequests = 0
  renderWorkspace(
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
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
        )
      if (path.includes('/notifications?state=unread')) {
        unreadRequests += 1
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: unreadRequests === 1 ? 1 : 0,
              data: [],
              next: null,
              previous: null,
            }),
          ),
        )
      }
      if (path.endsWith('/notifications'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 1,
              data: [
                {
                  kind: 'assignment',
                  id: 'notice-read',
                  activity_id: 'activity-1',
                  activity_reference: 'ACT-001',
                  activity_name: 'Formation',
                  pta_year: 2028,
                  pta_name: 'PTA Protection',
                  project_name: 'Protection de l’enfant',
                  assigned_by: 'Yoann Validateur',
                  created_at: '2028-02-08T08:00:00Z',
                  read_at: '2028-02-08T09:00:00Z',
                  email_status: 'delivered',
                  version: 2,
                },
              ],
              next: null,
              previous: null,
            }),
          ),
        )
      return Promise.resolve(new Response(JSON.stringify({})))
    }),
  )

  expect(
    await screen.findByRole('button', {
      name: 'Notifications, 1 non lues',
    }),
  ).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: /^Notifications/ }))
  await userEvent.click(screen.getByRole('link', { name: 'Voir l’activité' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: /1 non lues/ }),
    ).not.toBeInTheDocument(),
  )
  expect(unreadRequests).toBeGreaterThanOrEqual(2)
})
