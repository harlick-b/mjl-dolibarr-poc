import { beforeEach, expect, test, vi } from 'vitest'
import axios from 'axios'
import { RestClient } from './rest-client'
import { QueryClient } from '@tanstack/react-query'
import { createAccessCoordinator } from '@/features/auth/session/access-verification'

vi.mock('axios', () => ({
  default: {
    isCancel: (error) => error?.code === 'ERR_CANCELED',
    request: vi.fn(),
  },
}))

beforeEach(() => {
  axios.request.mockReset()
})

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

test('sends JSON writes through Axios with same-origin credentials and CSRF', async () => {
  axios.request.mockResolvedValueOnce({
    status: 200,
    data: JSON.stringify({ id: 'project-1', amount: '9007199254740993' }),
    headers: {},
  })

  const result = await new RestClient().request('/api/v1/projects', {
    method: 'POST',
    csrf: 'csrf-current',
    body: { name: 'Projet' },
  })

  expect(result).toEqual({
    id: 'project-1',
    amount: '9007199254740993',
  })
  expect(axios.request).toHaveBeenCalledWith(
    expect.objectContaining({
      url: '/api/v1/projects',
      method: 'POST',
      withCredentials: true,
      data: { name: 'Projet' },
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-current',
      }),
    }),
  )
})

test('sends protected file bodies without forcing a JSON content type', async () => {
  const file = new File(['evidence'], 'evidence.pdf', {
    type: 'application/pdf',
  })
  axios.request.mockResolvedValueOnce({
    status: 201,
    data: JSON.stringify({ id: 'document-1' }),
    headers: {},
  })

  await new RestClient().request('/api/v1/activities/activity-1/documents', {
    method: 'POST',
    csrf: 'csrf-current',
    rawBody: file,
  })

  const config = axios.request.mock.calls[0][0]
  expect(config.data).toBe(file)
  expect(config.headers['X-CSRF-Token']).toBe('csrf-current')
  expect(config.headers).not.toHaveProperty('Content-Type')
})

test('returns null for an empty success response', async () => {
  axios.request.mockResolvedValueOnce({ status: 204, data: '', headers: {} })

  await expect(
    new RestClient().request('/api/v1/notifications/item-1', {
      method: 'DELETE',
      csrf: 'csrf-current',
    }),
  ).resolves.toBeNull()
})

test('returns protected downloads with a safe response filename', async () => {
  const blob = new Blob(['report'], { type: 'text/csv' })
  axios.request.mockResolvedValueOnce({
    status: 200,
    data: blob,
    headers: {
      'content-disposition': 'attachment; filename="audit-2027.csv"',
    },
  })

  await expect(
    new RestClient().download('/api/v1/audit/export'),
  ).resolves.toEqual({ blob, filename: 'audit-2027.csv' })
  expect(axios.request).toHaveBeenCalledWith(
    expect.objectContaining({ responseType: 'blob', withCredentials: true }),
  )
})

test('rejects malformed success data without exposing the Axios response', async () => {
  axios.request.mockResolvedValueOnce({
    status: 200,
    data: '{invalid',
    headers: { authorization: 'synthetic-secret' },
  })

  await expect(
    new RestClient().request('/api/v1/projects'),
  ).rejects.toMatchObject({ name: 'ApiError', kind: 'malformed' })
})

test('normalizes Axios network failures to the safe client error', async () => {
  axios.request.mockRejectedValueOnce({
    message: 'socket failed',
    config: { headers: { authorization: 'synthetic-secret' } },
  })

  const request = new RestClient().request('/api/v1/projects')
  await expect(request).rejects.toMatchObject({
    name: 'ApiError',
    kind: 'network',
  })
  await expect(request).rejects.not.toHaveProperty('config')
})

test('rejects an untrusted API URL before credentials can be sent', async () => {
  await expect(
    new RestClient().request('https://attacker.example/api/v1/projects'),
  ).rejects.toMatchObject({ code: 'untrusted_api_url', kind: 'request' })
  expect(axios.request).not.toHaveBeenCalled()
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
  axios.request.mockImplementation(
    ({ signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject({ code: 'ERR_CANCELED' }),
          { once: true },
        )
      }),
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
  const body = vi.fn()
  axios.request.mockResolvedValue({
    status: 401,
    headers: {},
    get data() {
      body()
      return JSON.stringify({ code: 'session_expired' })
    },
  })
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
  axios.request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const request = client.request('/api/v1/projects')
  generation += 1
  finish({ status: 401, data: '', headers: {} })
  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  expect(requestFailed).not.toHaveBeenCalled()
})

test('Retry-After prevents resubmission until the server window ends', async () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'))
    axios.request.mockResolvedValue({
      status: 429,
      data: JSON.stringify({ code: 'limited' }),
      headers: { 'retry-after': '2' },
    })
    const client = new RestClient()

    await expect(client.request('/api/v1/projects')).rejects.toMatchObject({
      status: 429,
      retryAt: Date.parse('2027-01-01T00:00:02Z'),
    })
    await expect(client.request('/api/v1/projects')).rejects.toMatchObject({
      status: 429,
      kind: 'rate_limit',
    })
    expect(axios.request).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(2_000)
    await expect(client.request('/api/v1/projects')).rejects.toMatchObject({
      status: 429,
    })
    expect(axios.request).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})

test('csrf_invalid revalidates once without replaying the rejected write', async () => {
  const client = new RestClient()
  const writes = vi.fn()
  axios.request.mockImplementation(async ({ url, data }) => {
    if (url.endsWith('/auth/session'))
      return {
        status: 200,
        data: JSON.stringify(verifiedSession()),
        headers: {},
      }
    writes(data)
    return {
      status: 403,
      data: JSON.stringify({ code: 'csrf_invalid' }),
      headers: {},
    }
  })
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
    axios.request.mock.calls.filter(([config]) =>
      config.url.endsWith('/auth/session'),
    ),
  ).toHaveLength(2)
})

test('an ordinary protected 403 remains local and does not revalidate', async () => {
  const client = new RestClient()
  axios.request.mockImplementation(async ({ url }) =>
    url.endsWith('/auth/session')
      ? {
          status: 200,
          data: JSON.stringify(verifiedSession()),
          headers: {},
        }
      : {
          status: 403,
          data: JSON.stringify({ code: 'forbidden' }),
          headers: {},
        },
  )
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
    axios.request.mock.calls.filter(([config]) =>
      config.url.endsWith('/auth/session'),
    ),
  ).toHaveLength(1)
})
