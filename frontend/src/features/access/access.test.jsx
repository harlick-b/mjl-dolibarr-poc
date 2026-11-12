import { selectOption } from '@/test/select-option'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/react-router'
import { App, makeRouter } from '@/app/router'
import { toast } from 'sonner'

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
    await screen.findByRole('button', { name: 'Inviter un utilisateur' }),
  ).toBeVisible()
  expect(
    screen.getByRole('heading', { name: 'Utilisateurs', exact: true }),
  ).toBeVisible()
  expect(await screen.findByText('Aucun utilisateur')).toBeVisible()
})

test('Users exposes reference filters, count and no invitation delivery duplicate', async () => {
  const items = [
    {
      id: 'pending',
      full_name: 'Olive Agent',
      email: 'olive@example.test',
      role: 'AGENT_SAISIE',
      state: 'pending',
      version: 1,
      invitation: {
        id: 'invitation',
        state: 'delivered',
        delivery_status: 'delivered',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        version: 1,
      },
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
              : { items, total: 1, page: 1, size: 20 },
          ),
        ),
      ),
    ),
  )
  mount()
  expect(await screen.findByText('1 utilisateur')).toBeVisible()
  expect(
    screen.getByPlaceholderText('Rechercher un utilisateur…'),
  ).toBeVisible()
  expect(screen.queryByText('Envoyée · Envoyée')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Filtres' }))
  expect(screen.getByLabelText('Rôle')).toBeVisible()
  expect(screen.queryByLabelText('État du compte')).not.toBeInTheDocument()
})

test('Users keeps loaded rows and controls available during a filtered refresh', async () => {
  const initial = {
    items: [
      {
        id: 'olive',
        full_name: 'Olive Agent',
        email: 'olive@example.test',
        role: 'AGENT_SAISIE',
        state: 'active',
        version: 1,
      },
    ],
    total: 1,
    page: 1,
    size: 20,
  }
  let releaseSearch
  const filtered = new Promise((resolve) => {
    releaseSearch = () =>
      resolve(
        new Response(
          JSON.stringify({ items: [], total: 0, page: 1, size: 20 }),
        ),
      )
  })
  const fetch = vi.fn((url) => {
    if (url.includes('/auth/'))
      return Promise.resolve(new Response(JSON.stringify(session())))
    if (url.includes('q=absent')) return filtered
    return Promise.resolve(new Response(JSON.stringify(initial)))
  })
  vi.stubGlobal('fetch', fetch)
  mount()
  expect(await screen.findByText('Olive Agent')).toBeVisible()
  const search = screen.getByPlaceholderText('Rechercher un utilisateur…')
  fireEvent.change(search, { target: { value: 'absent' } })
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) => String(url).includes('q=absent')),
    ).toBe(true),
  )
  expect(screen.getByText('Olive Agent')).toBeVisible()
  expect(search).toBeEnabled()
  expect(
    screen.getByRole('status', { name: 'Actualisation des données' }),
  ).toBeVisible()
  releaseSearch()
  expect(
    await screen.findByRole('heading', { name: 'Aucun résultat' }),
  ).toBeVisible()
})

test('successful invitation reports through a toast', async () => {
  const success = vi.spyOn(toast, 'success').mockImplementation(() => '')
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options = {}) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('/auth/')
              ? session()
              : options.method === 'POST'
                ? { state: 'delivered' }
                : { items: [], total: 0, page: 1, size: 20 },
          ),
          { status: options.method === 'POST' ? 201 : 200 },
        ),
      ),
    ),
  )
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  try {
    mount()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Inviter un utilisateur' }),
    )
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Prénom *'), {
      target: { value: 'Olive' },
    })
    fireEvent.change(within(dialog).getByLabelText('Nom de famille *'), {
      target: { value: 'Agent' },
    })
    fireEvent.change(within(dialog).getByLabelText('Adresse e-mail *'), {
      target: { value: 'olive@example.test' },
    })
    fireEvent.submit(dialog.querySelector('form'))
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith('Invitation envoyée.'),
    )
    expect(screen.queryByText('Invitation envoyée.')).not.toBeInTheDocument()
  } finally {
    delete HTMLDialogElement.prototype.showModal
    delete HTMLDialogElement.prototype.close
  }
})

test('cancelling an invitation returns focus to its opening action', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('/auth/')
              ? session()
              : { items: [], total: 0, page: 1, size: 20 },
          ),
        ),
      ),
    ),
  )
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  try {
    mount()
    const invite = await screen.findByRole('button', {
      name: 'Inviter un utilisateur',
    })
    invite.focus()
    fireEvent.click(invite)
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Annuler',
      }),
    )
    await waitFor(() => expect(invite).toHaveFocus())
  } finally {
    delete HTMLDialogElement.prototype.showModal
    delete HTMLDialogElement.prototype.close
  }
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
  expect(
    screen.getByRole('link', { name: 'Retour à mon espace' }),
  ).toHaveAttribute('href', '/dashboard')
  expect(
    screen.getByRole('navigation', { name: 'Espace de travail' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('navigation', { name: 'Administration' }),
  ).toBeNull()
  expect(
    fetch.mock.calls.some(([url]) => String(url).includes('/api/v1/access/')),
  ).toBe(false)
})

test('unavailable identity shows login without a privileged view', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('{}', { status: 503 }))),
  )
  mount()
  expect(
    await screen.findByRole('heading', {
      name: 'Connexion',
    }),
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
  expect(alerts).toHaveLength(1)
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
    await screen.findByRole('heading', { name: 'Vérification' }),
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
  await waitFor(() => expect(pending).toHaveLength(1))
  await act(async () => {
    window.dispatchEvent(new Event('offline'))
  })
  await screen.findByRole('heading', { name: 'Connexion indisponible' })
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

test('a direct list denial stays local to the Admin view', async () => {
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
  expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0)
  expect(
    screen.getByRole('button', { name: 'Inviter un utilisateur' }),
  ).toBeVisible()
  expect(router.options.context.access.getSnapshot().status).toBe('verified')
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
    {
      id: 'partner-user',
      email: 'partner@example.test',
      role: 'PARTENAIRE',
      state: 'active',
      version: 1,
      partner_id: 'partner-1',
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
                  total: url.includes('/users?') ? 4 : 0,
                },
          ),
        ),
      ),
    ),
  )
  mount()
  expect(
    await screen.findAllByRole('button', { name: 'Modifier le rôle' }),
  ).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Désactiver' })).toHaveLength(2)
  expect(
    screen.queryByRole('button', { name: /réactiver|réinviter/i }),
  ).not.toBeInTheDocument()
})

test('Admin binds a Partner invitation to the selected Partner', async () => {
  let invitationBody
  const fetch = vi.fn((url, options = {}) => {
    if (options.method === 'POST') {
      invitationBody = JSON.parse(options.body)
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'invitation',
            user_id: 'partner-user',
            email: invitationBody.email,
            role: invitationBody.role,
            partner_id: invitationBody.partner_id,
            state: 'delivered',
            delivery_status: 'delivered',
            version: 1,
          }),
        ),
      )
    }
    if (String(url).includes('/auth/'))
      return Promise.resolve(new Response(JSON.stringify(session())))
    if (String(url).includes('/partners?'))
      return Promise.resolve(
        new Response(
          JSON.stringify(
            String(url).includes('cursor=second')
              ? {
                  object: 'list',
                  count: 1,
                  data: [
                    {
                      id: 'partner-1',
                      name: 'Partenaire Démo',
                      active: true,
                    },
                  ],
                  next: null,
                  previous: `${window.location.origin}/api/v1/partners?limit=100`,
                }
              : {
                  object: 'list',
                  count: 1,
                  data: [{ id: 'partner-0', name: 'Premier', active: true }],
                  next: `${window.location.origin}/api/v1/partners?limit=100&cursor=second`,
                  previous: null,
                },
          ),
        ),
      )
    return Promise.resolve(
      new Response(JSON.stringify({ items: [], total: 0, page: 1, size: 20 })),
    )
  })
  vi.stubGlobal('fetch', fetch)
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  mount()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Inviter un utilisateur' }),
  )
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Prénom *'), {
    target: { value: 'John' },
  })
  fireEvent.change(within(dialog).getByLabelText('Nom de famille *'), {
    target: { value: 'Doe' },
  })
  await selectOption(within(dialog).getByLabelText('Rôle'), 'Partenaire')
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) => String(url).includes('/partners?')),
    ).toBe(true),
  )
  await within(dialog).findByText('Premier')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Suivant' }))
  expect(await screen.findByText('Partenaire Démo')).toBeVisible()
  fireEvent.change(within(dialog).getByLabelText('Adresse e-mail *'), {
    target: { value: 'portal@example.test' },
  })
  await selectOption(
    within(dialog).getByLabelText('Partenaire *'),
    'Partenaire Démo',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }))
  await waitFor(() =>
    expect(invitationBody).toEqual({
      email: 'portal@example.test',
      full_name: 'John Doe',
      first_name: 'John',
      last_name: 'Doe',
      role: 'PARTENAIRE',
      partner_id: 'partner-1',
    }),
  )
})

test('Partner option authorization denial stays local to the invitation form', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/'))
        return Promise.resolve(new Response(JSON.stringify(session())))
      if (path.includes('/partners?'))
        return Promise.resolve(new Response('{}', { status: 403 }))
      return Promise.resolve(
        new Response(
          JSON.stringify({ items: [], total: 0, page: 1, size: 20 }),
        ),
      )
    }),
  )
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  try {
    const router = mount()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Inviter un utilisateur' }),
    )
    await selectOption(
      within(screen.getByRole('dialog')).getByLabelText('Rôle'),
      'Partenaire',
    )
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0)
    expect(router.options.context.access.getSnapshot().status).toBe('verified')
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  } finally {
    delete HTMLDialogElement.prototype.showModal
    delete HTMLDialogElement.prototype.close
  }
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
    await screen.findByRole('heading', { name: 'Connexion indisponible' })
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

test('Admin navigation omits default search values and preserves meaningful filters', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('/auth/')
              ? session()
              : { items: [], total: 0, page: 1, size: 20 },
          ),
        ),
      ),
    ),
  )
  const router = mount()
  await screen.findByRole('heading', { name: 'Utilisateurs', exact: true })
  await act(() => router.navigate({ to: '/access/users' }))
  expect(router.state.location.searchStr).toBe('')
  await act(() =>
    router.navigate({
      to: '/access/users',
      search: { role: 'AGENT_SAISIE', page: 2 },
    }),
  )
  expect(router.state.location.searchStr).toBe('?role=AGENT_SAISIE&page=2')
  await act(() =>
    router.navigate({ to: '/access/users', search: { role: '', page: 1 } }),
  )
  expect(router.state.location.searchStr).toBe('')
})

test('users page session failure clears the stale session and opens login without a retry click', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ state: 'anonymous', csrf: 'fresh' })),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ state: 'anonymous', csrf: 'new' })),
    )
  vi.stubGlobal('fetch', fetch)
  mount()
  expect(
    await screen.findByLabelText('Mot de passe *', { exact: true }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Réessayer la connexion' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Inviter un utilisateur' }),
  ).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(4)
})

test('Partner invitation choices load only on demand and paginate before submission', async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  const fetch = vi.fn(async (url, options = {}) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return new Response(JSON.stringify(session()))
    if (path.includes('/partners'))
      return new Response(
        JSON.stringify({
          data: [
            {
              id: path.includes('cursor=second') ? 'p2' : 'p1',
              name: path.includes('cursor=second')
                ? 'Second partenaire'
                : 'Premier partenaire',
              active: true,
            },
          ],
          count: 2,
          previous: null,
          next: path.includes('cursor=second')
            ? null
            : `${window.location.origin}/api/v1/partners?cursor=second`,
        }),
      )
    if (options.method === 'POST')
      return new Response(JSON.stringify({ state: 'delivered' }), {
        status: 201,
      })
    return new Response(
      JSON.stringify({ items: [], total: 0, page: 1, size: 20 }),
    )
  })
  vi.stubGlobal('fetch', fetch)
  mount()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Inviter un utilisateur' }),
  )
  const dialog = screen.getByRole('dialog')
  expect(
    fetch.mock.calls.some(([url]) => String(url).includes('/partners')),
  ).toBe(false)
  await selectOption(within(dialog).getByLabelText('Rôle'), 'Partenaire')
  expect(
    within(dialog).getByRole('button', { name: 'Envoyer l’invitation' }),
  ).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: 'Annuler' })).toBeEnabled()
  fireEvent.submit(dialog.querySelector('form'))
  expect(
    fetch.mock.calls.some(([, options]) => options.method === 'POST'),
  ).toBe(false)
  expect(await within(dialog).findByText('Premier partenaire')).toBeVisible()
  expect(
    fetch.mock.calls.filter(([url]) => String(url).includes('/partners')),
  ).toHaveLength(1)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Suivant' }))
  expect(await within(dialog).findByText('Second partenaire')).toBeVisible()
  await selectOption(
    within(dialog).getByLabelText('Partenaire *'),
    'Second partenaire',
  )
  fireEvent.change(within(dialog).getByLabelText('Prénom *'), {
    target: { value: 'Ada' },
  })
  fireEvent.change(within(dialog).getByLabelText('Nom de famille *'), {
    target: { value: 'Lovelace' },
  })
  fireEvent.change(within(dialog).getByLabelText('Adresse e-mail *'), {
    target: { value: 'ada@example.test' },
  })
  fireEvent.submit(dialog.querySelector('form'))
  await waitFor(() =>
    expect(
      fetch.mock.calls.find(([, options]) => options.method === 'POST'),
    ).toBeTruthy(),
  )
  const [, options] = fetch.mock.calls.find(
    ([, options]) => options.method === 'POST',
  )
  expect(JSON.parse(options.body).partner_id).toBe('p2')
})
