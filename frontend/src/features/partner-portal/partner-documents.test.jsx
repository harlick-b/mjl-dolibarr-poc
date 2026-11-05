import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { RestClientProvider } from '@/shared/api/RestClientProvider'
import { ActivityDocuments } from '@/features/planning/PlanningView'
import { App, makeRouter } from '@/app/router'

const list = (data) => ({
  object: 'list',
  count: data.length,
  data,
  next: null,
  previous: null,
})
afterEach(() => {
  window.dispatchEvent(new Event('online'))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('Validator sharing sends a version, refreshes the list, and never queues offline changes', async () => {
  let shared = false
  let version = 0
  let deny = false
  const api = {
    request: vi.fn(async (_path, options = {}) => {
      if (options.method === 'PATCH') {
        expect(options.body).toEqual({
          shared: !shared,
          expected_version: version,
        })
        expect(options.csrf).toBe('csrf')
        if (deny) throw Object.assign(new Error('stale'), { status: 409 })
        shared = options.body.shared
        version += 1
        return { shared, version }
      }
      return list([
        {
          id: 'file',
          name: 'rapport.pdf',
          media_type: 'application/pdf',
          partner_shared: shared,
          sharing_version: version,
          allowed_actions: [shared ? 'unshare' : 'share'],
        },
      ])
    }),
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RestClientProvider client={api}>
        <ActivityDocuments
          activityId="activity"
          user={{ id: 'validator', role: 'VALIDATEUR_DEFINITIF' }}
          csrf="csrf"
          cursor=""
          navigate={vi.fn()}
          blocked={false}
          onDenied={vi.fn()}
        />
      </RestClientProvider>
    </QueryClientProvider>,
  )
  fireEvent.click(
    await screen.findByRole('button', { name: 'Partager avec le Partenaire' }),
  )
  expect(
    await screen.findByRole('button', { name: 'Arrêter le partage' }),
  ).toBeEnabled()
  deny = true
  fireEvent.click(screen.getByRole('button', { name: 'Arrêter le partage' }))
  expect(
    await screen.findByText(/Le partage n’a pas été confirmé/),
  ).toBeVisible()
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Arrêter le partage' }),
    ).toBeEnabled(),
  )
  deny = false
  fireEvent.click(screen.getByRole('button', { name: 'Arrêter le partage' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Partager avec le Partenaire' }),
    ).toBeEnabled(),
  )
  const before = api.request.mock.calls.filter(
    ([, options]) => options?.method === 'PATCH',
  ).length
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  fireEvent.click(
    screen.getByRole('button', { name: 'Partager avec le Partenaire' }),
  )
  await waitFor(() => expect(client.isMutating()).toBe(0))
  expect(
    api.request.mock.calls.filter(([, options]) => options?.method === 'PATCH'),
  ).toHaveLength(before)
  expect(
    client
      .getMutationCache()
      .getAll()
      .every((mutation) => !mutation.state.isPaused),
  ).toBe(true)
})

function portalFixture(binary) {
  const reply = (body) => Promise.resolve(new Response(JSON.stringify(body)))
  return vi.fn((url, options) => {
    const path = String(url)
    if (path.endsWith('/preview') || path.endsWith('/download'))
      return binary(path, options)
    if (path.includes('/auth/session'))
      return reply({
        state: 'verified',
        csrf: 'csrf',
        user: {
          id: 'reader',
          email: 'user@example.test',
          role: 'PARTENAIRE',
          partner_id: 'partner',
        },
        expires_at: new Date(Date.now() + 60000).toISOString(),
      })
    if (path.endsWith('/profile'))
      return reply({ id: 'partner', name: 'Partenaire test' })
    if (path.includes('/projects?'))
      return reply(
        list([
          { id: 'project', reference: 'PROJ', name: 'Projet', state: 'active' },
        ]),
      )
    if (path.includes('/projects/project/ptas'))
      return reply(
        list([
          {
            id: 'pta',
            year: 2027,
            metrics: {
              physical: { closed_activities: 0, approved_activities: 1 },
              financial: { closed_spending: '0', approved_allocation: '100' },
            },
          },
        ]),
      )
    if (path.includes('/ptas/pta/activities'))
      return reply(
        list([
          {
            id: 'activity',
            reference: 'ACT',
            name: 'Activité',
            allocation: '100',
            state: 'approved',
          },
        ]),
      )
    if (path.endsWith('/activities/activity'))
      return reply({
        id: 'activity',
        name: 'Activité',
        reference: 'ACT',
        allocation: '100',
        operations: [],
        decisions: [],
        finance: null,
      })
    if (path.includes('/documents?'))
      return reply(
        list([
          { id: 'file', name: 'photo.png', media_type: 'image/png', size: 12 },
        ]),
      )
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
}

function preparePreview() {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  const NativeURL = URL
  class PreviewURL extends NativeURL {}
  PreviewURL.createObjectURL = vi.fn(() => 'blob:shared-photo')
  PreviewURL.revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', PreviewURL)
  return PreviewURL
}

test('Partner preview is protected, cleaned on close, and late bytes are discarded on navigation', async () => {
  const urls = preparePreview()
  let late
  let calls = 0
  vi.stubGlobal(
    'fetch',
    portalFixture(() => {
      calls += 1
      if (calls > 1)
        return new Promise((resolve) => {
          late = resolve
        })
      return Promise.resolve(
        new Response('image', { headers: { 'Content-Type': 'image/png' } }),
      )
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner?activity=activity'] }),
  )
  render(<App router={router} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Aperçu' }))
  expect(
    await screen.findByRole('img', { name: 'Aperçu de photo.png' }),
  ).toHaveAttribute('src', 'blob:shared-photo')
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:shared-photo')
  fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
  await waitFor(() => expect(late).toBeTypeOf('function'))
  await act(async () => {
    await router.navigate({ to: '/partner', search: {} })
  })
  await act(async () =>
    late(new Response('late', { headers: { 'Content-Type': 'image/png' } })),
  )
  expect(urls.createObjectURL).toHaveBeenCalledTimes(1)
})

test('Going offline discards a pending shared-file download', async () => {
  const urls = preparePreview()
  let late
  vi.stubGlobal(
    'fetch',
    portalFixture(
      () =>
        new Promise((resolve) => {
          late = resolve
        }),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/partner?activity=activity'] }),
      )}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }))
  await waitFor(() => expect(late).toBeTypeOf('function'))
  act(() => window.dispatchEvent(new Event('offline')))
  await act(async () =>
    late(new Response('late', { headers: { 'Content-Type': 'image/png' } })),
  )
  expect(urls.createObjectURL).not.toHaveBeenCalled()
  expect(screen.queryByText('photo.png')).not.toBeInTheDocument()
})

test('an older preview failure cannot cancel a newer preview', async () => {
  const urls = preparePreview()
  const pending = []
  vi.stubGlobal(
    'fetch',
    portalFixture(
      (_path, options) =>
        new Promise((resolve, reject) =>
          pending.push({ resolve, reject, signal: options.signal }),
        ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/partner?activity=activity'] }),
      )}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Aperçu' }))
  await waitFor(() => expect(pending).toHaveLength(1))
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
  await waitFor(() => expect(pending).toHaveLength(2))
  await act(async () =>
    pending[0].reject(new DOMException('Old cancelled request', 'AbortError')),
  )
  expect(pending[1].signal.aborted).toBe(false)
  await act(async () =>
    pending[1].resolve(
      new Response('image', { headers: { 'Content-Type': 'image/png' } }),
    ),
  )
  expect(
    await screen.findByRole('img', { name: 'Aperçu de photo.png' }),
  ).toBeVisible()
  expect(urls.createObjectURL).toHaveBeenCalledTimes(1)
})

test('a list refresh that removes sharing discards pending download bytes', async () => {
  const urls = preparePreview()
  let resolveDownload
  let shared = true
  const fixture = portalFixture(
    () =>
      new Promise((resolve) => {
        resolveDownload = resolve
      }),
  )
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      if (!shared && String(url).includes('/documents?'))
        return Promise.resolve(new Response(JSON.stringify(list([]))))
      return fixture(url, options)
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner?activity=activity'] }),
  )
  render(<App router={router} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }))
  await waitFor(() => expect(resolveDownload).toBeTypeOf('function'))
  shared = false
  await act(async () =>
    router.options.context.queryClient.invalidateQueries({
      queryKey: ['partner-portal', 'reader', 'documents'],
    }),
  )
  expect(await screen.findByText('Aucun document partagé.')).toBeVisible()
  await act(async () =>
    resolveDownload(
      new Response('late', { headers: { 'Content-Type': 'image/png' } }),
    ),
  )
  expect(urls.createObjectURL).not.toHaveBeenCalled()
})

test('fresh authorization denial discards pending shared-file bytes', async () => {
  const urls = preparePreview()
  let resolveDownload
  let denied = false
  const fixture = portalFixture(
    () =>
      new Promise((resolve) => {
        resolveDownload = resolve
      }),
  )
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      if (denied && String(url).includes('/documents?'))
        return Promise.resolve(new Response('{}', { status: 403 }))
      return fixture(url, options)
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner?activity=activity'] }),
  )
  render(<App router={router} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }))
  await waitFor(() => expect(resolveDownload).toBeTypeOf('function'))
  denied = true
  await act(async () =>
    router.options.context.queryClient.invalidateQueries({
      queryKey: ['partner-portal', 'reader', 'documents'],
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ce document est indisponible ou son partage a été arrêté.',
  )
  await act(async () =>
    resolveDownload(
      new Response('late', { headers: { 'Content-Type': 'image/png' } }),
    ),
  )
  expect(urls.createObjectURL).not.toHaveBeenCalled()
})

test('shared-document pagination uses Router state and rejects foreign links', async () => {
  const fixture = portalFixture(vi.fn())
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      const path = String(url)
      if (path.includes('/documents?')) {
        const second = path.includes('cursor=second')
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...list([
                {
                  id: second ? 'two' : 'one',
                  name: second ? 'second.pdf' : 'first.pdf',
                  media_type: 'application/pdf',
                  size: 20,
                },
              ]),
              count: 2,
              next: second
                ? 'https://foreign.example/api/v1/partner-portal/activities/activity/documents?cursor=bad'
                : `${window.location.origin}/api/v1/partner-portal/activities/activity/documents?limit=60&cursor=second`,
            }),
          ),
        )
      }
      return fixture(url, options)
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner?activity=activity'] }),
  )
  render(<App router={router} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Suivant' }))
  expect(await screen.findByText('second.pdf')).toBeVisible()
  expect(router.state.location.search.documentCursor).toBe('second')
  expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled()
})
