import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import { createMemoryHistory } from '@tanstack/react-router'
import { App, makeRouter } from './router.jsx'

test('renders the neutral MJL shell without business navigation', async () => {
  const router = makeRouter(createMemoryHistory({ initialEntries: ['/'] }))
  render(<App router={router} />)
  expect(
    await screen.findByRole('heading', { name: 'Espace MJL' }),
  ).toBeVisible()
  expect(screen.getByRole('link', { name: 'État du service' })).toHaveAttribute(
    'href',
    '/health',
  )
})

test('navigates to health and displays loading then the verified result', async () => {
  const { vi } = await import('vitest')
  const { default: userEvent } = await import('@testing-library/user-event')
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
  const router = makeRouter(createMemoryHistory({ initialEntries: ['/'] }))
  render(<App router={router} />)
  await screen.findByRole('heading', { name: 'Espace MJL' })
  await userEvent.click(screen.getByRole('link', { name: 'État du service' }))
  expect(await screen.findByText('Vérification en cours…')).toBeVisible()
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
    screen.getByRole('link', { name: 'Retour à l’accueil' }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Espace MJL' }),
  ).toBeVisible()
})
