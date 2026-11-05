import { expect, test, vi } from 'vitest'
import { RestClient } from './rest-client'
import { QueryClient } from '@tanstack/react-query'
import { createAccessCoordinator } from '@/features/auth/access-verification'

function verifiedSession() {
  return {
    state: 'verified',
    csrf: 'csrf-current',
    user: {
      id: 'agent-1',
      email: 'agent@example.test',
      role: 'AGENT_SAISIE',
    },
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  }
}

test('rejects an untrusted API URL before credentials can be sent', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)

  await expect(
    new RestClient().request('https://attacker.example/api/v1/projects'),
  ).rejects.toMatchObject({ code: 'untrusted_api_url', kind: 'request' })
  expect(fetch).not.toHaveBeenCalled()
})

test('access cleanup aborts an in-flight protected request', async () => {
  let cleanup
  const unregister = vi.fn()
  const client = new RestClient()
  client.configureAccess({
    getSnapshot: () => ({ generation: 1 }),
    registerCleanup: (callback) => {
      cleanup = callback
      return unregister
    },
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_path, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        }),
    ),
  )

  const request = client.request('/api/v1/projects')
  cleanup()

  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  expect(unregister).toHaveBeenCalledOnce()
})

test('a protected 401 masks access without waiting for its response body', async () => {
  const requestFailed = vi.fn()
  const client = new RestClient()
  client.configureAccess({
    getSnapshot: () => ({ generation: 1 }),
    registerCleanup: () => vi.fn(),
    requestFailed,
  })
  const body = vi.fn(() => new Promise(() => {}))
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, status: 401, json: body }),
  )
  const request = client.request('/api/v1/projects')
  await expect(request).rejects.toMatchObject({ status: 401 })
  expect(requestFailed).toHaveBeenCalledOnce()
  expect(body).not.toHaveBeenCalled()
})

test('an obsolete protected response cannot trigger current-generation handling', async () => {
  let generation = 1
  let finish
  const requestFailed = vi.fn()
  const client = new RestClient()
  client.configureAccess({
    getSnapshot: () => ({ generation }),
    registerCleanup: () => vi.fn(),
    requestFailed,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    ),
  )
  const request = client.request('/api/v1/projects')
  generation += 1
  finish({ ok: false, status: 401 })
  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  expect(requestFailed).not.toHaveBeenCalled()
})

test('Retry-After prevents resubmission until the server window ends', async () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'))
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'limited' }), {
        status: 429,
        headers: { 'Retry-After': '2' },
      }),
    )
    vi.stubGlobal('fetch', fetch)
    const client = new RestClient()

    await expect(client.request('/api/v1/projects')).rejects.toMatchObject({
      status: 429,
      retryAt: Date.parse('2027-01-01T00:00:02Z'),
    })
    await expect(client.request('/api/v1/projects')).rejects.toMatchObject({
      status: 429,
      kind: 'rate_limit',
    })
    expect(fetch).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    await expect(client.request('/api/v1/projects')).rejects.toMatchObject({
      status: 429,
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})

test('csrf_invalid revalidates once without replaying the rejected write', async () => {
  const client = new RestClient()
  const writes = vi.fn()
  const fetch = vi.fn(async (path, options = {}) => {
    if (String(path).endsWith('/auth/session'))
      return new Response(JSON.stringify(verifiedSession()))
    writes(options.body)
    return new Response(JSON.stringify({ code: 'csrf_invalid' }), {
      status: 403,
    })
  })
  vi.stubGlobal('fetch', fetch)
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession: ({ signal }) => client.auth('session', { signal }),
  })
  client.configureAccess(coordinator)
  await coordinator.verify()

  await expect(
    client.request('/api/v1/projects', {
      method: 'POST',
      csrf: 'stale',
      body: { name: 'Projet' },
    }),
  ).rejects.toMatchObject({ status: 403, code: 'csrf_invalid' })
  await vi.waitFor(() =>
    expect(coordinator.getSnapshot().status).toBe('verified'),
  )

  expect(writes).toHaveBeenCalledOnce()
  expect(
    fetch.mock.calls.filter(([path]) => String(path).endsWith('/auth/session')),
  ).toHaveLength(2)
})

test('an ordinary protected 403 remains local and does not revalidate', async () => {
  const client = new RestClient()
  const fetch = vi.fn(async (path) =>
    String(path).endsWith('/auth/session')
      ? new Response(JSON.stringify(verifiedSession()))
      : new Response(JSON.stringify({ code: 'forbidden' }), { status: 403 }),
  )
  vi.stubGlobal('fetch', fetch)
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession: ({ signal }) => client.auth('session', { signal }),
  })
  client.configureAccess(coordinator)
  await coordinator.verify()

  await expect(client.request('/api/v1/projects')).rejects.toMatchObject({
    status: 403,
    code: 'forbidden',
  })

  expect(coordinator.getSnapshot().status).toBe('verified')
  expect(
    fetch.mock.calls.filter(([path]) => String(path).endsWith('/auth/session')),
  ).toHaveLength(1)
})
