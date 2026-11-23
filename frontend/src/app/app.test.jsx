import { act, waitFor, render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/react-router'
import { App, makeRouter } from './router.jsx'

test('anonymous visitors land directly on login', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ state: 'anonymous', csrf: 'fixture' })),
      ),
    ),
  )
  const router = makeRouter(createMemoryHistory({ initialEntries: ['/'] }))
  render(<App router={router} />)
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(
    await screen.findByRole('heading', { name: 'Connexion' }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe('/login')
  expect(
    screen.queryByRole('link', { name: 'État du service' }),
  ).not.toBeInTheDocument()
})

test('navigates to health and displays loading then the verified result', async () => {
  const { vi } = await import('vitest')
  let finish
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    ),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/health'] }),
  )
  const { container } = render(<App router={router} />)
  expect(
    await screen.findByRole('status', {
      name: 'Chargement de l’état du service',
    }),
  ).toBeVisible()
  finish(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
  expect(await screen.findByText('Service disponible')).toBeVisible()
  expect(document.title).toBe('État du service')
  expect(container.querySelector('[data-ui~="auth-layout"]')).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('health remains directly available during session-service recovery', async () => {
  sessionStorage.setItem('mjl.logout-pending', 'login')
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
      ),
    ),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/health'] }),
  )
  const { container } = render(<App router={router} />)

  expect(await screen.findByText('Service disponible')).toBeVisible()
  expect(router.state.location.pathname).toBe('/health')
  expect(container.querySelector('[data-ui~="auth-layout"]')).toBeNull()
  sessionStorage.removeItem('mjl.logout-pending')
})

test.each([
  [503, { status: 'unavailable' }, 'Service indisponible'],
  [500, {}, 'Erreur de vérification'],
  [200, { status: 'unexpected' }, 'Erreur de vérification'],
])(
  'shows HTTP %s accurately without retries',
  async (status, body, message) => {
    const { vi } = await import('vitest')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
    )
    const router = makeRouter(
      createMemoryHistory({ initialEntries: ['/health'] }),
    )
    render(<App router={router} />)
    expect(await screen.findByText(message)).toBeVisible()
    expect(screen.queryByText('Service disponible')).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  },
)

test('network failure is unavailable and retry can recover', async () => {
  const { vi } = await import('vitest')
  const { default: userEvent } = await import('@testing-library/user-event')
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network failure'))
      .mockResolvedValueOnce(new Response('{"status":"ok"}')),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/health'] }),
  )
  render(<App router={router} />)
  expect(await screen.findByText('Service indisponible')).toBeVisible()
  await userEvent.click(
    screen.getByRole('button', { name: 'Vérifier maintenant' }),
  )
  expect(await screen.findByText('Service disponible')).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('the removed generic Activity route is not accepted', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ state: 'anonymous', csrf: 'fixture' })),
      ),
    ),
  )
  const { default: userEvent } = await import('@testing-library/user-event')
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/activities/fixture'] }),
      )}
    />,
  )
  expect(
    await screen.findByRole('heading', { name: 'Page introuvable' }),
  ).toBeVisible()
  expect(document.querySelector('[data-ui~="auth-card"]')).toBeNull()
  await userEvent.click(
    screen.getByRole('link', { name: 'Retour à mon espace' }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Connexion' }),
  ).toBeVisible()
})

test('notifications are available from the sidebar modal, not a standalone page', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'fixture',
            user: {
              id: 'agent',
              email: 'agent@example.test',
              role: 'AGENT_SAISIE',
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
        createMemoryHistory({ initialEntries: ['/notifications'] }),
      )}
    />,
  )

  expect(
    await screen.findByRole('heading', { name: 'Page introuvable' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Notifications' }),
  ).not.toBeInTheDocument()
})

test('an unknown route waits for session verification before choosing its shell', async () => {
  let finishSession
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (input) =>
        new Promise((resolve) => {
          if (String(input).endsWith('/auth/session')) {
            finishSession = () =>
              resolve(
                new Response(
                  JSON.stringify({
                    state: 'verified',
                    csrf: 'fixture',
                    user: {
                      id: 'unknown-route-agent',
                      email: 'agent@example.test',
                      role: 'AGENT_SAISIE',
                    },
                    expires_at: new Date(Date.now() + 60_000).toISOString(),
                  }),
                ),
              )
            return
          }
          resolve(
            new Response(
              JSON.stringify({
                object: 'list',
                data: [],
                count: 0,
                next: null,
                previous: null,
              }),
            ),
          )
        }),
    ),
  )
  const { container } = render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/adresse-inconnue'] }),
      )}
    />,
  )

  await waitFor(() => expect(finishSession).toBeTypeOf('function'))
  expect(screen.queryByRole('heading', { name: 'Page introuvable' })).toBeNull()

  finishSession()
  expect(
    await screen.findByRole('heading', { name: 'Page introuvable' }),
  ).toBeVisible()
  expect(
    container.querySelector('[data-ui~="workspace-shell"]'),
  ).toBeInTheDocument()
  expect(container.querySelector('[data-ui~="auth-layout"]')).toBeNull()
})

test.each([
  '/projects/projet-inconnu',
  '/partner/page-inconnue',
  '/execution/page-inconnue/extra',
])('an anonymous unknown route at %s retains the auth shell', async (path) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ state: 'anonymous', csrf: 'fixture' })),
      ),
    ),
  )
  const router = makeRouter(createMemoryHistory({ initialEntries: [path] }))
  const { container } = render(<App router={router} />)

  expect(
    await screen.findByRole('heading', { name: 'Page introuvable' }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe(path)
  expect(
    container.querySelector('[data-ui~="auth-layout"]'),
  ).toBeInTheDocument()
  expect(container.querySelector('[data-ui~="auth-brand"]')).toBeInTheDocument()
  expect(container.querySelector('[data-ui~="auth-card"]')).toBeNull()
})

function ThrowingRoute() {
  throw new Error('private framework diagnostic')
}

function StaticAuthRoute() {
  return <p>Transition d’authentification</p>
}

function StaticProtectedRoute() {
  return <p>Espace protégé</p>
}

test('an authentication route keeps navigation ownership after an identity change', async () => {
  let userId = 'first-agent'
  vi.stubGlobal(
    'fetch',
    vi.fn((input) => {
      if (String(input).endsWith('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: {
                id: userId,
                email: `${userId}@example.test`,
                role: 'AGENT_SAISIE',
              },
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            }),
          ),
        )
      return Promise.resolve(new Response('{}'))
    }),
  )
  const router = makeRouter(
    createMemoryHistory({
      initialEntries: ['/planning/activities/activity-fixture'],
    }),
    { auth: StaticAuthRoute, planning: StaticProtectedRoute },
  )
  render(<App router={router} />)

  expect(await screen.findByText('Espace protégé')).toBeVisible()
  await act(() => router.navigate({ to: '/login' }))
  expect(await screen.findByText('Transition d’authentification')).toBeVisible()

  userId = 'second-agent'
  await act(() =>
    router.options.context.access.verify({
      manual: true,
      reason: 'credentials',
    }),
  )

  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
})

test('the health route keeps navigation ownership after an identity change', async () => {
  let userId = 'first-agent'
  vi.stubGlobal(
    'fetch',
    vi.fn((input) => {
      if (String(input).endsWith('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: {
                id: userId,
                email: `${userId}@example.test`,
                role: 'AGENT_SAISIE',
              },
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            }),
          ),
        )
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
      )
    }),
  )
  const router = makeRouter(
    createMemoryHistory({
      initialEntries: ['/planning/activities/activity-fixture'],
    }),
    { planning: StaticProtectedRoute },
  )
  render(<App router={router} />)

  expect(await screen.findByText('Espace protégé')).toBeVisible()
  await act(() => router.navigate({ to: '/health' }))
  expect(await screen.findByText('Service disponible')).toBeVisible()

  userId = 'second-agent'
  await act(() =>
    router.options.context.access.verify({
      manual: true,
      reason: 'credentials',
    }),
  )

  await waitFor(() => expect(router.state.location.pathname).toBe('/health'))
})

test('an authentication route failure retains the authentication frame', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ state: 'anonymous', csrf: 'fixture' })),
      ),
    ),
  )
  const { container } = render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/login'] }), {
        auth: ThrowingRoute,
      })}
    />,
  )

  expect(
    await screen.findByRole('heading', { name: 'Une erreur est survenue' }),
  ).toBeVisible()
  expect(
    container.querySelector('[data-ui~="auth-layout"]'),
  ).toBeInTheDocument()
  expect(container.querySelector('[data-ui~="auth-brand"]')).toBeInTheDocument()
  expect(screen.queryByText('private framework diagnostic')).toBeNull()
})

test('a protected route failure retains the verified workspace frame', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'fixture',
            user: {
              id: 'agent',
              email: 'agent@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        ),
      ),
    ),
  )
  const { container } = render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: ['/projects/project/ptas/2026'],
        }),
        { planning: ThrowingRoute },
      )}
    />,
  )

  expect(
    await screen.findByRole('heading', { name: 'Une erreur est survenue' }),
  ).toBeVisible()
  expect(
    container.querySelector('[data-ui~="workspace-shell"]'),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('navigation', { name: 'Espace de travail' }),
  ).toBeVisible()
  expect(screen.queryByText('private framework diagnostic')).toBeNull()
})

test('Agent login and OTP reach the default Dashboard without a refresh', async () => {
  const { default: userEvent } = await import('@testing-library/user-event')
  let state = 'anonymous'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input) => {
      const url = String(input)
      if (url.endsWith('/auth/login')) state = 'pending'
      if (url.endsWith('/auth/otp/verify')) state = 'verified'
      if (url.endsWith('/auth/session'))
        return new Response(
          JSON.stringify({
            state,
            csrf: 'fixture',
            email: 'a***@example.test',
            ...(state === 'verified'
              ? {
                  user: {
                    id: 'fresh-login-agent',
                    role: 'AGENT_SAISIE',
                    email: 'agent@example.test',
                  },
                  expires_at: new Date(Date.now() + 3600000).toISOString(),
                }
              : {}),
          }),
        )
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        }),
      )
    }),
  )
  const router = makeRouter(createMemoryHistory({ initialEntries: ['/login'] }))
  render(<App router={router} />)
  await userEvent.type(
    await screen.findByLabelText('Adresse e-mail *'),
    'agent@example.test',
  )
  await userEvent.type(
    screen.getByLabelText('Mot de passe *', { exact: true }),
    'ValidPass1!',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
  await userEvent.type(
    await screen.findByLabelText('Code de vérification', { exact: true }),
    '123456',
  )
  await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
  expect(
    await screen.findByRole('heading', { name: 'Tableau de bord', level: 1 }),
  ).toBeVisible()
  expect(screen.queryByText('Accès refusé')).not.toBeInTheDocument()
})

test('workspace navigation keeps only filters that belong to the page', async () => {
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/health'] }),
  )
  const link = router.buildLocation({
    to: '/projects',
    search: {
      tab: 'finance',
      origin: 'execution',
      review: 'all',
      mine: 'own',
      view: 'table',
      cursor: 'older',
      page: 4,
    },
  })
  expect(link.href).toBe('/projects')
})

test('sidebar account opens a menu without changing the current page', async () => {
  const { default: userEvent } = await import('@testing-library/user-event')
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (input) =>
        new Response(
          JSON.stringify(
            String(input).endsWith('/auth/session')
              ? {
                  state: 'verified',
                  csrf: 'fixture',
                  user: {
                    id: 'menu-admin',
                    role: 'ADMIN_PLATEFORME',
                    email: 'admin@example.test',
                  },
                  expires_at: new Date(Date.now() + 3600000).toISOString(),
                }
              : {
                  object: 'list',
                  data: [],
                  count: 0,
                  next: null,
                  previous: null,
                },
          ),
        ),
    ),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/access/users'] }),
  )
  render(<App router={router} />)
  await userEvent.click(
    await screen.findByRole('button', { name: 'Mon compte' }),
  )
  expect(await screen.findByRole('menu', { name: 'Mon compte' })).toBeVisible()
  expect(screen.getByRole('menuitem', { name: 'Se déconnecter' })).toBeVisible()
  expect(router.state.location.pathname).toBe('/access/users')
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})
