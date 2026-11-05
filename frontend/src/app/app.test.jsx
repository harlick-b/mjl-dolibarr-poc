import { waitFor, render, screen } from '@testing-library/react'
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
  render(<App router={router} />)
  expect(
    await screen.findByRole('status', {
      name: 'Chargement de l’état du service',
    }),
  ).toBeVisible()
  finish(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
  expect(await screen.findByText('Service disponible')).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(1)
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

test('unknown routes offer a real return to home', async () => {
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
      router={makeRouter(createMemoryHistory({ initialEntries: ['/absent'] }))}
    />,
  )
  expect(
    await screen.findByRole('heading', { name: 'Page introuvable' }),
  ).toBeVisible()
  await userEvent.click(
    screen.getByRole('link', { name: 'Retour à mon espace' }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Connexion' }),
  ).toBeVisible()
})

function ThrowingRoute() {
  throw new Error('private framework diagnostic')
}

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
  expect(container.querySelector('.auth-layout')).toBeInTheDocument()
  expect(container.querySelector('.auth-brand')).toBeInTheDocument()
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
        createMemoryHistory({ initialEntries: ['/projects'] }),
        { planning: ThrowingRoute },
      )}
    />,
  )

  expect(
    await screen.findByRole('heading', { name: 'Une erreur est survenue' }),
  ).toBeVisible()
  expect(container.querySelector('.workspace-shell')).toBeInTheDocument()
  expect(
    screen.getByRole('navigation', { name: 'Espace de travail' }),
  ).toBeVisible()
  expect(screen.queryByText('private framework diagnostic')).toBeNull()
})
