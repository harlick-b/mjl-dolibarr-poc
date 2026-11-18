import { expect, test, vi } from 'vitest'
import { RestClient } from './rest-client'

test('a protected 401 masks access before its response body completes', async () => {
  const requestFailed = vi.fn()
  const client = new RestClient()
  client.configureAccess({
    getSnapshot: () => ({ generation: 1 }),
    registerCleanup: () => vi.fn(),
    requestFailed,
  })
  const pendingBody = new ReadableStream({ start() {} })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(pendingBody, {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )

  await expect(client.request('/api/v1/projects')).rejects.toMatchObject({
    status: 401,
  })
  expect(requestFailed).toHaveBeenCalledOnce()
})

test('caller cancellation stays silent while an error response body is pending', async () => {
  const requestFailed = vi.fn()
  const client = new RestClient()
  client.configureAccess({
    getSnapshot: () => ({ generation: 1 }),
    registerCleanup: () => vi.fn(),
    requestFailed,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn((_url, { signal }) => {
      const pendingBody = new ReadableStream({
        start(controller) {
          signal.addEventListener(
            'abort',
            () => controller.error(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        },
      })
      return Promise.resolve(
        new Response(pendingBody, {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }),
  )
  const controller = new AbortController()

  const request = client.request('/api/v1/projects', {
    signal: controller.signal,
  })
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  controller.abort()

  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  expect(requestFailed).not.toHaveBeenCalled()
})
