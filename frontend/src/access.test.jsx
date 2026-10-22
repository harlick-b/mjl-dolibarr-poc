import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

// Real dialog focus and network behavior are covered by the browser journey.
test('ordinary active rows expose lifecycle actions but Admin and inactive rows do not', async () => {
  const items = [
    {
      id: 'actor',
      email: 'actor@example.test',
      role: 'ADMIN_PLATEFORME',
      state: 'active',
      version: 2,
    },
    {
      id: 'ordinary',
      email: 'ordinary@example.test',
      role: 'AGENT_SAISIE',
      state: 'active',
      version: 2,
    },
    {
      id: 'inactive',
      email: 'inactive@example.test',
      role: 'AGENT_SAISIE',
      state: 'inactive',
      version: 3,
    },
  ]
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('/auth/')
              ? session()
              : {
                  items: url.includes('/users?') ? items : [],
                  total: url.includes('/users?') ? 3 : 0,
                },
          ),
        ),
      ),
    ),
  )
  mount()
  expect(
    await screen.findByRole('button', { name: 'Modifier le rôle' }),
  ).toBeVisible()
  expect(screen.getAllByRole('button', { name: 'Désactiver' })).toHaveLength(1)
  expect(
    screen.queryByRole('button', { name: /réactiver|réinviter/i }),
  ).not.toBeInTheDocument()
})

test('late lifecycle completion after offline invalidation cannot restore protected queries', async () => {
  let finish
  const items = [
    {
      id: 'ordinary',
      email: 'ordinary@example.test',
      role: 'AGENT_SAISIE',
      state: 'active',
      version: 2,
    },
  ]
  const fetch = vi.fn((url, options) => {
    if (options?.method === 'PATCH')
      return new Promise((resolve) => {
        finish = resolve
      })
    return Promise.resolve(
      new Response(
        JSON.stringify(
          url.includes('/auth/')
            ? session()
            : { items: url.includes('/users?') ? items : [], total: 1 },
        ),
      ),
    )
  })
  vi.stubGlobal('fetch', fetch)
  // jsdom lacks native dialog methods; browser tests verify the real behavior.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  try {
    const router = mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmer la désactivation' }),
    )
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    expect(
      fetch.mock.calls.find(([, o]) => o?.method === 'PATCH')[1],
    ).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ expected_version: 2, deactivate: true }),
    })
    await act(async () => window.dispatchEvent(new Event('offline')))
    await screen.findByRole('heading', { name: 'Accès à vérifier' })
    await act(async () =>
      finish(
        new Response(
          JSON.stringify({ ...items[0], state: 'inactive', version: 3 }),
        ),
      ),
    )
    expect(screen.queryByText('Compte désactivé.')).not.toBeInTheDocument()
    expect(
      router.options.context.queryClient.getQueriesData({
        queryKey: ['access'],
      }),
    ).toEqual([])
    expect(
      fetch.mock.calls.filter(([, o]) => o?.method === 'PATCH'),
    ).toHaveLength(1)
  } finally {
    delete HTMLDialogElement.prototype.showModal
    delete HTMLDialogElement.prototype.close
  }
})
