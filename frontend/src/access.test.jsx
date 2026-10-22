import { act, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/react-router'
import { App, makeRouter } from './router'

test('Admin sees the empty account view and invitation action', async () => {
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
                    id: 'admin',
                    email: 'admin@example.test',
                    role: 'ADMIN_PLATEFORME',
                  },
                  expires_at: new Date(Date.now() + 60000).toISOString(),
                }
              : { items: [], total: 0, page: 1, size: 20 },
          ),
        ),
      ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/access/users'] }),
      )}
    />,
  )
  expect(
    await screen.findByRole('heading', { name: 'Utilisateurs', exact: true }),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Inviter un utilisateur' }),
  ).toBeVisible()
  expect(await screen.findByText('Aucun utilisateur.')).toBeVisible()
})

function session(role = 'ADMIN_PLATEFORME') {
  return {
    state: 'verified',
    csrf: 'fixture',
    user: { id: 'actor', email: 'actor@example.test', role },
    expires_at: new Date(Date.now() + 60000).toISOString(),
  }
}
function mount() {
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/access/users'] }),
  )
  render(<App router={router} />)
  return router
}

test('non-Admin sees denial and never requests the account lists', async () => {
  const fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(session('AGENT_SAISIE')))),
  )
  vi.stubGlobal('fetch', fetch)
  mount()
  expect(
    await screen.findByRole('heading', { name: 'Accès refusé' }),
  ).toBeVisible()
  expect(fetch.mock.calls.every(([url]) => url.includes('/auth/'))).toBe(true)
})

test('unavailable identity does not become a logout or privileged view', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('{}', { status: 503 }))),
  )
  mount()
  expect(
    await screen.findByRole('heading', { name: 'Service indisponible' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Inviter un utilisateur' }),
  ).not.toBeInTheDocument()
})

test('malformed or unavailable account responses show retry instead of stale rows', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('/auth/') ? session() : { items: 'invalid', total: 0 },
          ),
        ),
      ),
    ),
  )
  mount()
  const alerts = await screen.findAllByRole('alert')
  expect(alerts).toHaveLength(2)
  expect(alerts[0]).toHaveTextContent('Liste indisponible')
})

test('pending identity redirects to the usable OTP screen', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'pending',
            csrf: 'fixture',
            email: 'a***@example.test',
          }),
        ),
      ),
    ),
  )
  mount()
  expect(
    await screen.findByRole('heading', { name: 'Vérifiez votre identité' }),
  ).toBeVisible()
  expect(screen.getByLabelText('Code de vérification')).toBeVisible()
})

test('offline invalidation cancels lists and ignores late responses', async () => {
  const pending = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      url.includes('/auth/')
        ? Promise.resolve(new Response(JSON.stringify(session())))
        : new Promise((resolve) => pending.push(resolve)),
    ),
  )
  const router = mount()
  await screen.findByRole('heading', { name: 'Utilisateurs', exact: true })
  await waitFor(() => expect(pending).toHaveLength(2))
  await act(async () => {
    window.dispatchEvent(new Event('offline'))
  })
  await screen.findByRole('heading', { name: 'Accès à vérifier' })
  await act(async () => {
    for (const resolve of pending)
      resolve(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'private',
                email: 'private@example.test',
                role: 'AGENT_SAISIE',
                state: 'pending',
                version: 1,
              },
            ],
            total: 1,
            page: 1,
            size: 20,
          }),
        ),
      )
  })
  expect(screen.queryByText('private@example.test')).not.toBeInTheDocument()
  expect(
    router.options.context.queryClient.getQueriesData({ queryKey: ['access'] }),
  ).toEqual([])
})

test('a direct API denial removes Admin controls and sensitive query data', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve(
        url.includes('/auth/')
          ? new Response(JSON.stringify(session()))
          : new Response('{}', { status: 403 }),
      ),
    ),
  )
  const router = mount()
  expect(
    await screen.findByRole('heading', { name: 'Accès à vérifier' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Inviter un utilisateur' }),
  ).not.toBeInTheDocument()
  expect(
    router.options.context.queryClient.getQueriesData({ queryKey: ['access'] }),
  ).toEqual([])
})
