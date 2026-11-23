import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router'

test('dashboard attention titles and actions link to their activity workflow', async () => {
  const list = (data) => ({
    object: 'list',
    count: data.length,
    data,
    next: null,
    previous: null,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = new URL(url, window.location.origin).pathname
      let body
      if (path.endsWith('/auth/session'))
        body = {
          state: 'verified',
          csrf: 'fixture',
          user: {
            id: 'agent',
            role: 'AGENT_SAISIE',
            email: 'agent@example.test',
          },
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }
      else if (path === '/api/v1/projects')
        body = list([{ id: 'project', name: 'Projet' }])
      else if (path === '/api/v1/projects/project/ptas')
        body = list([{ id: 'pta', year: 2026 }])
      else if (path === '/api/v1/ptas/pta/dashboard')
        body = {
          physical: { closed_activities: 0, approved_activities: 0 },
          financial: { closed_spending: '0', approved_allocation: '0' },
          finance: { approved_tasks: 0, recorded_tasks: 0 },
          attention: {
            count: 5,
            items: [
              {
                activity_id: 'planning-id',
                name: 'Activité à préparer',
                destination: 'planning',
                reason: 'draft_to_complete',
                action: 'edit',
              },
              {
                activity_id: 'execution-id',
                name: 'Activité à réaliser',
                destination: 'execution',
                reason: 'reversement_required',
                action: 'view',
              },
              {
                activity_id: 'prevalidation-id',
                name: 'Activité à prévalider',
                destination: 'planning',
                reason: 'planning_prevalidation',
                action: 'review_planning',
              },
              {
                activity_id: 'approval-id',
                name: 'Décaissement à valider',
                destination: 'execution',
                reason: 'disbursement_approval',
                action: 'review_finance',
              },
              {
                activity_id: 'approved-correction-id',
                name: 'Activité approuvée à corriger',
                destination: 'execution',
                reason: 'correction_requested',
                action: 'review_planning',
              },
            ],
          },
        }
      else body = list([])
      return new Response(JSON.stringify(body))
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/dashboard'] }),
      )}
    />,
  )
  for (const [name, href] of [
    ['Activité à préparer', '/planning/activities/planning-id'],
    ['Activité à réaliser', '/execution/activities/execution-id#finance'],
    [
      'Activité approuvée à corriger',
      '/execution/activities/approved-correction-id',
    ],
  ]) {
    const title = await screen.findByRole('link', { name }, { timeout: 5000 })
    const links = within(title.closest('li')).getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute('href', href)
  }
  expect(
    within(
      screen.getByRole('link', { name: 'Activité à préparer' }).closest('li'),
    ).getByRole('link', { name: 'Compléter l’activité' }),
  ).toBeVisible()
  expect(
    within(
      screen.getByRole('link', { name: 'Activité à prévalider' }).closest('li'),
    ).getByRole('link', { name: 'Prévalider l’activité' }),
  ).toBeVisible()
  expect(
    within(
      screen
        .getByRole('link', { name: 'Décaissement à valider' })
        .closest('li'),
    ).getByRole('link', { name: 'Valider le décaissement' }),
  ).toBeVisible()
})

test('a copied dashboard selection shows an error when its Project lookup fails', async () => {
  const list = (data, next = null) => ({
    object: 'list',
    count: data.length,
    data,
    next,
    previous: null,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'fixture',
            user: {
              id: 'agent',
              role: 'AGENT_SAISIE',
              email: 'agent@example.test',
            },
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        )
      if (path.includes('/api/v1/projects?') && path.includes('cursor=next'))
        return new Response('{}', { status: 503 })
      if (path.endsWith('/api/v1/projects'))
        return new Response(
          JSON.stringify(
            list(
              [{ id: 'project-1', name: 'Projet Un' }],
              '/api/v1/projects?cursor=next',
            ),
          ),
        )
      return new Response(JSON.stringify(list([])))
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: ['/dashboard?project=project-copied'],
        }),
      )}
    />,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'momentanément indisponibles',
  )
  expect(screen.queryByText('Aucun projet actif')).not.toBeInTheDocument()
})

test('a denied copied Project lookup clears its dependent Planning cache', async () => {
  const list = (data, next = null) => ({
    object: 'list',
    count: data.length,
    data,
    next,
    previous: null,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'fixture',
            user: {
              id: 'agent',
              role: 'AGENT_SAISIE',
              email: 'agent@example.test',
            },
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        )
      if (path.includes('/api/v1/projects?') && path.includes('cursor=next'))
        return new Response('{}', { status: 403 })
      if (path.endsWith('/api/v1/projects'))
        return new Response(
          JSON.stringify(
            list(
              [{ id: 'project-1', name: 'Projet Un' }],
              '/api/v1/projects?cursor=next',
            ),
          ),
        )
      return new Response(JSON.stringify(list([])))
    }),
  )
  const router = makeRouter(
    createMemoryHistory({
      initialEntries: ['/dashboard?project=project-denied'],
    }),
  )
  const protectedKeys = [
    ['planning', 'agent', 'projects', 'older'],
    ['planning', 'agent', 'ptas', 'project-private', 'older'],
    ['planning', 'agent', 'project', 'previous-selection'],
    ['execution', 'agent', 'list', 'pta-private'],
  ]
  for (const key of protectedKeys)
    router.options.context.queryClient.setQueryData(key, {
      data: [{ id: 'private-record' }],
    })
  render(<App router={router} />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'momentanément indisponibles',
  )
  for (const key of protectedKeys)
    expect(router.options.context.queryClient.getQueryData(key)).toBeUndefined()
  expect(
    router.options.context.queryClient.getQueryState([
      'planning',
      'agent',
      'project',
      'project-denied',
    ])?.status,
  ).toBe('error')
  expect(
    router.options.context.queryClient.getQueryData(['auth', 'session']).state,
  ).toBe('verified')
})

test('changing the project clears the local Activity page cursor', async () => {
  const list = (data, next = null, previous = null) => ({
    object: 'list',
    count: data.length,
    data,
    next,
    previous,
  })
  const fetch = vi.fn(async (url) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return new Response(
        JSON.stringify({
          state: 'verified',
          csrf: 'fixture',
          user: {
            id: 'agent',
            role: 'AGENT_SAISIE',
            email: 'agent@example.test',
          },
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        }),
      )
    if (path.includes('/api/v1/projects?cursor=second'))
      return new Response(
        JSON.stringify(
          list(
            [{ id: 'project-2', name: 'Projet Deux' }],
            null,
            '/api/v1/projects',
          ),
        ),
      )
    if (path.endsWith('/api/v1/projects'))
      return new Response(
        JSON.stringify(
          list(
            [{ id: 'project-1', name: 'Projet Un' }],
            '/api/v1/projects?cursor=second',
          ),
        ),
      )
    if (path.includes('/projects/project-1/ptas'))
      return new Response(JSON.stringify(list([{ id: 'pta-1', year: 2026 }])))
    if (path.includes('/projects/project-2/ptas'))
      return new Response(JSON.stringify(list([{ id: 'pta-2', year: 2027 }])))
    if (path.includes('/ptas/pta-1/execution?cursor=older'))
      return new Response(
        JSON.stringify(list([], null, '/api/v1/ptas/pta-1/execution')),
      )
    if (path.endsWith('/ptas/pta-1/execution'))
      return new Response(
        JSON.stringify(list([], '/api/v1/ptas/pta-1/execution?cursor=older')),
      )
    if (path.endsWith('/ptas/pta-2/execution'))
      return new Response(JSON.stringify(list([])))
    return new Response(JSON.stringify(list([])))
  })
  vi.stubGlobal('fetch', fetch)

  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/execution'] }),
      )}
    />,
  )

  fireEvent.click(
    within(
      await screen.findByRole('navigation', {
        name: 'Pagination des activités',
      }),
    ).getByRole('button', { name: 'Suivant' }),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) =>
        String(url).includes('/ptas/pta-1/execution?cursor=older'),
      ),
    ).toBe(true),
  )
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Projets' })).getByRole(
      'button',
      { name: 'Suivant' },
    ),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) =>
        String(url).endsWith('/ptas/pta-2/execution'),
      ),
    ).toBe(true),
  )
  expect(
    fetch.mock.calls.some(([url]) =>
      String(url).includes('/ptas/pta-2/execution?cursor='),
    ),
  ).toBe(false)
})
