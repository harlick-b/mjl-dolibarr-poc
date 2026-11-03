import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from './router'

afterEach(() => {
  window.dispatchEvent(new Event('online'))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('a Partner sees only the read-only portfolio projection', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      let body
      if (path.includes('/auth/session'))
        body = {
          state: 'verified',
          user: {
            id: 'partner-user',
            role: 'PARTENAIRE',
            partner_id: 'partner-1',
          },
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        }
      else if (path.endsWith('/partner-portal/profile'))
        body = { id: 'partner-1', name: 'Partenaire Démonstration' }
      else if (path.includes('/partner-portal/projects?'))
        body = {
          object: 'list',
          count: 1,
          data: [
            {
              id: 'project-1',
              reference: 'PRJ-2027-001',
              name: 'Projet Santé',
              state: 'active',
            },
          ],
          next: null,
          previous: null,
        }
      else if (path.includes('/projects/project-1/ptas'))
        body = {
          object: 'list',
          count: 1,
          data: [
            {
              id: 'pta-1',
              year: 2027,
              metrics: {
                pta_id: 'pta-1',
                as_of: '2027-10-30T10:00:00Z',
                physical: { closed_activities: 1, approved_activities: 2 },
                financial: {
                  closed_spending: '90000',
                  approved_allocation: '120000',
                },
              },
            },
          ],
          next: null,
          previous: null,
        }
      else if (path.includes('/ptas/pta-1/activities'))
        body = {
          object: 'list',
          count: 1,
          data: [
            {
              id: 'activity-1',
              reference: 'ACT-001',
              name: 'Campagne de santé',
              planned_start: '2027-01-10',
              planned_end: '2027-03-10',
              allocation: '120000',
              state: 'closed',
              approved_revision: 1,
            },
          ],
          next: null,
          previous: null,
        }
      else return Promise.resolve(new Response('{}', { status: 404 }))
      return Promise.resolve(new Response(JSON.stringify(body)))
    }),
  )

  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/partner'] }))}
    />,
  )

  expect(
    await screen.findByRole('heading', {
      name: 'Bonjour, Partenaire Démonstration',
    }),
  ).toBeVisible()
  expect(screen.getByText('Espace Partenaire · Lecture seule')).toBeVisible()
  const navigation = screen.getByRole('navigation', {
    name: 'Espace Partenaire',
  })
  expect(within(navigation).getAllByRole('link')).toHaveLength(2)
  expect(await screen.findByText('Projet Santé')).toBeVisible()
  expect(await screen.findByText('Campagne de santé')).toBeVisible()
  expect(screen.getByText('1 activité clôturée sur 2')).toBeVisible()
  expect(screen.queryByText(/export/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/pièce jointe/i)).not.toBeInTheDocument()
})

test('offline invalidation removes the Partner portfolio immediately', async () => {
  let sessionUnavailable = false
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session') && sessionUnavailable)
        return Promise.resolve(new Response('{}', { status: 503 }))
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              user: {
                id: 'partner-user',
                role: 'PARTENAIRE',
                partner_id: 'partner-1',
              },
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/partner-portal/profile'))
        return Promise.resolve(
          new Response(
            JSON.stringify({ id: 'partner-1', name: 'Donnée privée' }),
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
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner'] }),
  )
  render(<App router={router} />)
  expect(await screen.findByText('Bonjour, Donnée privée')).toBeVisible()
  await act(async () => window.dispatchEvent(new Event('offline')))
  expect(screen.queryByText('Bonjour, Donnée privée')).not.toBeInTheDocument()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'accès doit être vérifié',
  )
  expect(
    router.options.context.queryClient
      .getQueriesData({ queryKey: ['partner-portal'] })
      .every(([, data]) => data === undefined),
  ).toBe(true)
  fireEvent(window, new Event('online'))
  sessionUnavailable = true
  fireEvent.click(screen.getByRole('button', { name: 'Vérifier mon accès' }))
  expect(
    await screen.findByText('Votre identité n’a pas pu être vérifiée.'),
  ).toBeVisible()
  expect(screen.queryByText('Bonjour, Donnée privée')).not.toBeInTheDocument()
  sessionUnavailable = false
  fireEvent.click(screen.getByRole('button', { name: 'Vérifier mon accès' }))
  expect(await screen.findByText('Bonjour, Donnée privée')).toBeVisible()
})

test('a denied portal response masks and purges previously loaded data', async () => {
  let projects = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              user: { id: 'partner-user', role: 'PARTENAIRE' },
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/partner-portal/profile'))
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'p1', name: 'Donnée privée' })),
        )
      if (path.includes('/partner-portal/projects?')) {
        projects += 1
        return Promise.resolve(
          projects === 1
            ? new Response(
                JSON.stringify({
                  object: 'list',
                  count: 0,
                  data: [],
                  next: null,
                  previous: null,
                }),
              )
            : new Response('{}', { status: 403 }),
        )
      }
      return Promise.resolve(new Response('{}', { status: 404 }))
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner'] }),
  )
  const view = render(<App router={router} />)
  expect(await screen.findByText('Bonjour, Donnée privée')).toBeVisible()
  view.unmount()
  render(<App router={router} />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'accès doit être vérifié',
  )
  expect(screen.queryByText('Donnée privée')).not.toBeInTheDocument()
  expect(
    router.options.context.queryClient
      .getQueriesData({ queryKey: ['partner-portal'] })
      .every(([, data]) => data === undefined),
  ).toBe(true)
})

test('an initially offline portal never requests private portfolio data', async () => {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
  const fetch = vi.fn((url) => {
    if (String(url).includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            user: { id: 'partner-user', role: 'PARTENAIRE' },
          }),
        ),
      )
    return Promise.resolve(new Response('{}'))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/partner'] }))}
    />,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'accès doit être vérifié',
  )
  expect(
    fetch.mock.calls.every(
      ([url]) => !String(url).includes('/partner-portal/'),
    ),
  ).toBe(true)
})

test('portal pagination follows server cursors through router search', async () => {
  const fetch = vi.fn((url) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            user: { id: 'partner-user', role: 'PARTENAIRE' },
          }),
        ),
      )
    if (path.endsWith('/partner-portal/profile'))
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'p1', name: 'Partenaire' })),
      )
    if (path.includes('/partner-portal/projects?')) {
      const second = path.includes('cursor=second')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: [
              {
                id: second ? 'project-2' : 'project-1',
                reference: second ? 'PRJ-002' : 'PRJ-001',
                name: second ? 'Projet Deux' : 'Projet Un',
                state: 'active',
              },
            ],
            next: second
              ? null
              : 'http://localhost/api/v1/partner-portal/projects?limit=60&cursor=second',
            previous: second
              ? 'http://localhost/api/v1/partner-portal/projects?limit=60'
              : null,
          }),
        ),
      )
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
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/partner'] }))}
    />,
  )
  expect(await screen.findByText('Projet Un')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
  expect(await screen.findByText('Projet Deux')).toBeVisible()
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) => String(url).includes('cursor=second')),
    ).toBe(true),
  )
  expect(screen.getByRole('button', { name: 'Précédent' })).toBeEnabled()
})

test('a verified Partner can enter the portal from the identity screen', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'partner-user',
              email: 'partner@example.test',
              role: 'PARTENAIRE',
              partner_id: 'partner-1',
            },
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        ),
      ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/identity'] }),
      )}
    />,
  )
  expect(
    await screen.findByRole('link', {
      name: 'Accéder à mon espace Partenaire',
    }),
  ).toHaveAttribute('href', '/partner')
})
