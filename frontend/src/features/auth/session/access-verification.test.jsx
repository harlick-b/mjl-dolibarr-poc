import { StrictMode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import {
  AccessProvider,
  createAccessCoordinator,
  useAccess,
} from './access-verification'
import { ApiError } from '@/shared/api/rest-client'

afterEach(() => sessionStorage.clear())

function verifiedSession() {
  return {
    state: 'verified',
    csrf: 'csrf-current',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: 'agent-1',
      email: 'agent@example.test',
      role: 'AGENT_SAISIE',
    },
  }
}

function AccessStatus() {
  const access = useAccess()
  return <span>{access.status}</span>
}

test('session service failure holds local sign-out across reload without restoring a surviving cookie', async () => {
  const queryClient = new QueryClient()
  const readSession = vi
    .fn()
    .mockRejectedValue(new ApiError('Unavailable', { status: 502 }))
  const access = createAccessCoordinator({ queryClient, readSession })
  await expect(access.verify()).rejects.toMatchObject({ status: 502 })
  expect(access.getSnapshot()).toMatchObject({
    status: 'blocked',
    session: null,
    reason: 'service-unavailable',
  })
  await access.changed()
  await access.show()
  expect(readSession).toHaveBeenCalledTimes(1)
  access.dispose()
  const restored = createAccessCoordinator({
    queryClient,
    readSession: vi.fn().mockResolvedValue(verifiedSession()),
  })
  expect(restored.getSnapshot().reason).toBe('service-unavailable')
  await expect(restored.verify()).rejects.toMatchObject({
    kind: 'logout_pending',
  })
  restored.releaseLogout()
  restored.dispose()
})

test('coalesces access uncertainty into one bounded verification', async () => {
  const queryClient = new QueryClient()
  const session = verifiedSession()
  let release
  const readSession = vi.fn(
    () =>
      new Promise((resolve) => {
        release = () => resolve(session)
      }),
  )
  const coordinator = createAccessCoordinator({ queryClient, readSession })

  const first = coordinator.uncertain('/api/v1/projects')
  const second = coordinator.uncertain('/api/v1/projects')

  expect(coordinator.getSnapshot().status).toBe('checking')
  await vi.waitFor(() => expect(readSession).toHaveBeenCalledTimes(1))
  release()
  await Promise.all([first, second])
  expect(coordinator.getSnapshot().status).toBe('verified')
  expect(readSession).toHaveBeenCalledTimes(1)
})

test('ordinary service failure remains local to the request', async () => {
  const queryClient = new QueryClient()
  const coordinator = createAccessCoordinator({
    queryClient,
    readSession: vi.fn().mockResolvedValue(verifiedSession()),
  })
  await coordinator.verify({ manual: true })

  coordinator.requestFailed(
    '/api/v1/projects',
    new ApiError('Service indisponible.', { status: 503 }),
  )

  expect(coordinator.getSnapshot().status).toBe('verified')
})

test('changing tabs preserves verified access and cached data', async () => {
  const queryClient = new QueryClient()
  const coordinator = createAccessCoordinator({
    queryClient,
    readSession: vi.fn().mockResolvedValue(verifiedSession()),
  })
  await coordinator.verify({ manual: true })
  queryClient.setQueryData(['planning', 'agent-1'], { secret: 'protected' })

  render(
    <AccessProvider coordinator={coordinator}>
      <AccessStatus />
    </AccessProvider>,
  )
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(coordinator.getSnapshot().status).toBe('verified')
  expect(queryClient.getQueryData(['planning', 'agent-1'])).toEqual({
    secret: 'protected',
  })
})

test('page lifecycle events do not discard data or refetch a valid session', async () => {
  const queryClient = new QueryClient()
  const readSession = vi.fn().mockResolvedValue(verifiedSession())
  const coordinator = createAccessCoordinator({ queryClient, readSession })
  await coordinator.verify({ manual: true })
  queryClient.setQueryData(['planning', 'agent-1'], { secret: 'protected' })
  render(
    <AccessProvider coordinator={coordinator}>
      <AccessStatus />
    </AccessProvider>,
  )

  act(() => window.dispatchEvent(new Event('pagehide')))
  expect(screen.getByText('verified')).toBeVisible()
  expect(queryClient.getQueryData(['planning', 'agent-1'])).toEqual({
    secret: 'protected',
  })

  await act(async () => window.dispatchEvent(new Event('pageshow')))
  expect(await screen.findByText('verified')).toBeVisible()
  expect(readSession).toHaveBeenCalledTimes(1)
})

test('online return resumes an access check after offline masking', async () => {
  const readSession = vi.fn().mockResolvedValue(verifiedSession())
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession,
  })
  await coordinator.verify()

  coordinator.offline()
  expect(coordinator.getSnapshot().status).toBe('blocked')
  await coordinator.show()

  expect(coordinator.getSnapshot().status).toBe('verified')
  expect(readSession).toHaveBeenCalledTimes(2)
})

test('reconnecting starts a fresh check after cancelling an older cycle', async () => {
  const readSession = vi
    .fn()
    .mockImplementationOnce(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        }),
    )
    .mockResolvedValueOnce(verifiedSession())
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession,
  })
  const first = coordinator.verify().catch(() => null)
  await vi.waitFor(() => expect(readSession).toHaveBeenCalledOnce())

  coordinator.offline()
  await expect(coordinator.show()).resolves.not.toThrow()
  await first

  expect(coordinator.getSnapshot().status).toBe('verified')
  expect(readSession).toHaveBeenCalledTimes(2)
})

test('malformed verified session never opens the protected gate', async () => {
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession: vi.fn().mockResolvedValue({
      state: 'verified',
      csrf: 'csrf',
      user: { id: 'agent-1', email: 'user@example.test', role: 'AGENT_SAISIE' },
    }),
  })

  await expect(coordinator.verify({ manual: true })).rejects.toMatchObject({
    kind: 'malformed',
  })
  expect(coordinator.getSnapshot().status).toBe('blocked')
})

test.each([
  { state: 'anonymous', csrf: '' },
  { state: 'pending', csrf: 'csrf' },
  {
    state: 'verified',
    csrf: 'csrf',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    user: { id: 'agent-1', email: '', role: 'AGENT_SAISIE' },
  },
])('rejects an incomplete session contract: $state', async (session) => {
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession: vi.fn().mockResolvedValue(session),
  })

  await expect(coordinator.verify()).rejects.toMatchObject({
    kind: 'malformed',
  })
  expect(coordinator.getSnapshot().status).toBe('blocked')
})

test('ends a stalled verification at the total deadline and ignores its late result', async () => {
  let release
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    timeoutMs: 5,
    readSession: vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    ),
  })

  await expect(coordinator.verify()).rejects.toMatchObject({ kind: 'timeout' })
  expect(coordinator.getSnapshot().status).toBe('blocked')
  release(verifiedSession())
  await Promise.resolve()
  expect(coordinator.getSnapshot().status).toBe('blocked')
})

test('uses at most two session requests when authentication bootstrap fails', async () => {
  const readSession = vi
    .fn()
    .mockRejectedValue(new ApiError('Session expirée.', { status: 401 }))
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession,
  })

  await expect(coordinator.verify()).rejects.toMatchObject({ status: 401 })
  expect(readSession).toHaveBeenCalledTimes(2)
  expect(coordinator.getSnapshot().status).toBe('anonymous')
})

test('a service failure preparing anonymous context requires fresh sign-in', async () => {
  const readSession = vi
    .fn()
    .mockRejectedValueOnce(new ApiError('Session expirée.', { status: 401 }))
    .mockRejectedValueOnce(
      new ApiError('Service indisponible.', { status: 503 }),
    )
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession,
  })

  await expect(coordinator.verify()).rejects.toMatchObject({ status: 503 })
  expect(coordinator.getSnapshot()).toMatchObject({
    status: 'blocked',
    reason: 'service-unavailable',
    session: null,
  })
  expect(readSession).toHaveBeenCalledTimes(2)
})

test('an authentication change supersedes an active check within its request budget', async () => {
  let releaseFirst
  const latest = verifiedSession()
  latest.user.id = 'agent-2'
  const readSession = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = resolve
        }),
    )
    .mockResolvedValueOnce(latest)
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession,
  })
  const first = coordinator.verify()
  await vi.waitFor(() => expect(readSession).toHaveBeenCalledOnce())

  const changed = coordinator.changed()
  releaseFirst(verifiedSession())
  await Promise.all([first, changed])

  expect(readSession).toHaveBeenCalledTimes(2)
  expect(coordinator.getSnapshot().session.user.id).toBe('agent-2')
})

test('an authentication change cannot replenish a stalled cycle deadline', async () => {
  vi.useFakeTimers()
  try {
    let rejectFirst
    const readSession = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject
          }),
      )
      .mockImplementationOnce(() => new Promise(() => {}))
    const coordinator = createAccessCoordinator({
      queryClient: new QueryClient(),
      readSession,
      timeoutMs: 10_000,
    })
    const result = coordinator.verify().catch((error) => error)
    await vi.advanceTimersByTimeAsync(0)
    expect(readSession).toHaveBeenCalledOnce()

    const changed = coordinator.changed()
    rejectFirst(new ApiError('Service indisponible.', { status: 503 }))
    await vi.advanceTimersByTimeAsync(0)
    expect(readSession).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10_000)

    await changed
    await expect(result).resolves.toMatchObject({ kind: 'timeout' })
    expect(readSession).toHaveBeenCalledTimes(2)
    expect(coordinator.getSnapshot().status).toBe('blocked')
  } finally {
    vi.useRealTimers()
  }
})

test('a change during the final allowed read cannot reopen obsolete access', async () => {
  let releaseSecond
  const readSession = vi
    .fn()
    .mockRejectedValueOnce(new ApiError('Session expirée.', { status: 401 }))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSecond = resolve
        }),
    )
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession,
  })
  const result = coordinator.verify().catch((error) => error)
  await vi.waitFor(() => expect(readSession).toHaveBeenCalledTimes(2))

  const changed = coordinator.changed()
  releaseSecond(verifiedSession())

  await changed
  await expect(result).resolves.toMatchObject({
    kind: 'authentication_changed',
  })
  expect(readSession).toHaveBeenCalledTimes(2)
  expect(coordinator.getSnapshot().status).toBe('blocked')
})

test('an unconfirmed logout remains held across an application reload', async () => {
  sessionStorage.removeItem('mjl.logout-pending')
  try {
    const first = createAccessCoordinator({
      queryClient: new QueryClient(),
      readSession: vi.fn().mockResolvedValue(verifiedSession()),
    })
    await first.verify()
    first.holdLogout('csrf-current')
    await expect(first.verify()).rejects.toMatchObject({
      kind: 'logout_pending',
    })

    const second = createAccessCoordinator({
      queryClient: new QueryClient(),
      readSession: vi.fn().mockResolvedValue(verifiedSession()),
    })
    expect(second.getSnapshot()).toMatchObject({
      status: 'blocked',
      reason: 'logout',
    })
    await expect(second.prepareLogout()).resolves.toBe('csrf-current')
    second.releaseLogout()
    expect(sessionStorage.getItem('mjl.logout-pending')).toBeNull()
  } finally {
    sessionStorage.removeItem('mjl.logout-pending')
  }
})

test('a repeated denial after successful recovery stays blocked without a loop', async () => {
  const readSession = vi.fn().mockResolvedValue(verifiedSession())
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession,
  })
  await coordinator.verify({ manual: true })
  await coordinator.uncertain('/api/v1/projects')

  await coordinator.uncertain('/api/v1/projects')

  expect(coordinator.getSnapshot().status).toBe('blocked')
  expect(readSession).toHaveBeenCalledTimes(2)
})

test('cross-tab authentication changes still reverify when this tab is hidden', async () => {
  const readSession = vi.fn().mockResolvedValue(verifiedSession())
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession,
  })
  await coordinator.verify()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await coordinator.changed()
  expect(coordinator.getSnapshot()).toMatchObject({
    status: 'verified',
  })
  expect(readSession).toHaveBeenCalledTimes(2)
  coordinator.dispose()
})

test('cross-tab authentication changes cannot cancel unconfirmed logout', async () => {
  const readSession = vi.fn().mockResolvedValue(verifiedSession())
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession,
  })
  try {
    await coordinator.verify()
    coordinator.holdLogout('csrf-current')
    await coordinator.changed()
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'blocked',
      reason: 'logout',
    })
    expect(sessionStorage.getItem('mjl.logout-pending')).toBe('true')
    expect(readSession).toHaveBeenCalledOnce()
  } finally {
    coordinator.releaseLogout()
    coordinator.dispose()
  }
})

test('malformed anonymous bootstrap preserves the known authentication failure', async () => {
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession: vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Expired', { status: 401 }))
      .mockResolvedValueOnce({ state: 'anonymous' }),
  })
  await expect(coordinator.verify()).rejects.toMatchObject({
    kind: 'malformed',
  })
  expect(coordinator.getSnapshot().status).toBe('anonymous')
  coordinator.dispose()
})

test('service recovery starts only once for one loaded application', () => {
  const coordinator = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession: vi.fn(),
  })
  expect(coordinator.beginServiceRecovery()).toBe(true)
  expect(coordinator.beginServiceRecovery()).toBe(false)
  coordinator.dispose()
})

test('a disposed coordinator cannot publish a late outage or retain its hold', async () => {
  let reject
  const access = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession: () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  })
  const result = access.verify().catch((error) => error)
  await vi.waitFor(() => expect(reject).toBeDefined())
  access.dispose()
  reject(new ApiError('Unavailable', { status: 502 }))
  await result
  expect(sessionStorage.getItem('mjl.logout-pending')).toBeNull()
})

test('provider unmount disposes a pending check without retaining a late outage', async () => {
  let reject
  const access = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession: () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  })
  const view = render(
    <AccessProvider coordinator={access}>
      <AccessStatus />
    </AccessProvider>,
  )
  let result
  await act(async () => {
    result = access.verify().catch((error) => error)
  })
  await vi.waitFor(() => expect(reject).toBeDefined())
  view.unmount()
  await Promise.resolve()
  reject(new ApiError('Unavailable', { status: 502 }))
  await result
  expect(sessionStorage.getItem('mjl.logout-pending')).toBeNull()
})

test('StrictMode effect replay keeps the access coordinator usable', async () => {
  const access = createAccessCoordinator({
    queryClient: new QueryClient(),
    readSession: vi.fn().mockResolvedValue(verifiedSession()),
  })
  render(
    <StrictMode>
      <AccessProvider coordinator={access}>
        <AccessStatus />
      </AccessProvider>
    </StrictMode>,
  )
  await act(async () => {
    await access.verify()
  })
  expect(screen.getByText('verified')).toBeVisible()
})
