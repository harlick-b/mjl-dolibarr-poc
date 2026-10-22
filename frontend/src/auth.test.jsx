import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { App, makeRouter } from './router'

test('login is French, keyboard accessible, and reveals password without submitting', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ state: 'anonymous', csrf: 'fixture' })),
        ),
      ),
  )
  const router = makeRouter(createMemoryHistory({ initialEntries: ['/login'] }))
  render(<App router={router} />)
  const password = await screen.findByLabelText('Mot de passe')
  await userEvent.type(password, 'Synthetic!93')
  expect(password).toHaveAttribute('type', 'password')
  await userEvent.click(
    screen.getByRole('button', { name: 'Afficher le mot de passe' }),
  )
  expect(password).toHaveAttribute('type', 'text')
  expect(
    screen.queryByRole('link', { name: /inscription|oublié/i }),
  ).not.toBeInTheDocument()
})

test('failed password submission removes sensitive mutation variables', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation((_url, options) =>
        Promise.resolve(
          options.method === 'POST'
            ? new Response('{}', { status: 503 })
            : new Response(
                JSON.stringify({ state: 'anonymous', csrf: 'fixture' }),
              ),
        ),
      ),
  )
  const router = makeRouter(createMemoryHistory({ initialEntries: ['/login'] }))
  render(<App router={router} />)
  await userEvent.type(
    await screen.findByLabelText('Adresse e-mail'),
    'first@example.test',
  )
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'Synthetic!93')
  await userEvent.click(
    screen.getByRole('button', { name: 'Se connecter', exact: true }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Service indisponible',
  )
  expect(
    router.options.context.queryClient.getMutationCache().getAll(),
  ).toHaveLength(0)
  expect(screen.getByLabelText('Mot de passe')).toHaveValue('')
})

test('unmount purges a pending credential mutation', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation((_url, options) =>
        options.method === 'POST'
          ? new Promise(() => {})
          : Promise.resolve(
              new Response(
                JSON.stringify({ state: 'anonymous', csrf: 'fixture' }),
              ),
            ),
      ),
  )
  const router = makeRouter(createMemoryHistory({ initialEntries: ['/login'] }))
  const view = render(<App router={router} />)
  await userEvent.type(
    await screen.findByLabelText('Adresse e-mail'),
    'first@example.test',
  )
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'Synthetic!93')
  await userEvent.click(
    screen.getByRole('button', { name: 'Se connecter', exact: true }),
  )
  view.unmount()
  expect(
    router.options.context.queryClient.getMutationCache().getAll(),
  ).toHaveLength(0)
})

test('one logical OTP input accepts pasted code and keyboard submission', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((_url, options) =>
      Promise.resolve(
        options.method === 'POST'
          ? new Response('{}', { status: 400 })
          : new Response(
              JSON.stringify({
                state: 'pending',
                csrf: 'fixture',
                email: 'f***@example.test',
              }),
            ),
      ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/verification'] }),
      )}
    />,
  )
  const input = await screen.findByLabelText('Code de vérification')
  await user.click(input)
  await user.paste('123456')
  expect(input).toHaveValue('123456')
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Vérification refusée',
  )
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/auth/otp/verify',
    expect.objectContaining({ body: JSON.stringify({ code: '123456' }) }),
  )
})
