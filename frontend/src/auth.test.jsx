import { act, render, screen, waitFor } from '@testing-library/react'
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
    screen.queryByRole('link', { name: /inscription/i }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Mot de passe oublié ?' }),
  ).toHaveAttribute('href', '/forgot-password')
})

test('recovery request shows only the approved neutral confirmation', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((_url, options) =>
      Promise.resolve(
        options?.method === 'POST'
          ? new Response(JSON.stringify({ state: 'request_received' }), {
              status: 202,
            })
          : new Response(
              JSON.stringify({ state: 'anonymous', csrf: 'fixture' }),
            ),
      ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/forgot-password'] }),
      )}
    />,
  )
  await userEvent.type(
    await screen.findByLabelText('Adresse e-mail'),
    'unknown@example.test',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Envoyer le lien de récupération' }),
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Si ce compte peut être récupéré, vous recevrez un lien.',
  )
  expect(document.title).toBe('Mot de passe oublié')
})

test('reset proof is scrubbed before inspection and success returns to login', async () => {
  window.history.replaceState(
    {},
    '',
    '/reset-password#selector=fixture-selector&verifier=fixture-verifier',
  )
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url) => {
      if (url.endsWith('/session'))
        return Promise.resolve(
          new Response(JSON.stringify({ state: 'anonymous', csrf: 'fixture' })),
        )
      expect(window.location.hash).toBe('')
      if (url.endsWith('/inspect'))
        return Promise.resolve(
          new Response(JSON.stringify({ email: 'ordinary@example.test' })),
        )
      return Promise.resolve(
        new Response(JSON.stringify({ state: 'password_reset' })),
      )
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/reset-password'] }),
  )
  render(<App router={router} />)
  expect(
    await screen.findByDisplayValue('ordinary@example.test'),
  ).toHaveAttribute('readonly')
  await userEvent.type(
    screen.getByLabelText('Nouveau mot de passe'),
    'Recovered!94',
  )
  await userEvent.type(
    screen.getByLabelText('Confirmer le mot de passe'),
    'Recovered!94',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }),
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Votre mot de passe a été réinitialisé.',
  )
  expect(router.state.matches.at(-1).loaderData).toBeNull()
  expect(
    screen.getByRole('link', { name: 'Retour à la connexion' }),
  ).toHaveAttribute('href', '/login')
  expect(document.title).toBe('Réinitialiser le mot de passe')
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/auth/password-reset/complete',
    expect.objectContaining({
      body: JSON.stringify({
        selector: 'fixture-selector',
        verifier: 'fixture-verifier',
        password: 'Recovered!94',
        confirmation: 'Recovered!94',
      }),
    }),
  )
})

test('stale session is cleared once without losing a valid reset proof', async () => {
  window.history.replaceState(
    {},
    '',
    '/reset-password#selector=fixture-selector&verifier=fixture-verifier',
  )
  let sessionCalls = 0
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url) => {
      if (url.endsWith('/session')) {
        sessionCalls += 1
        return Promise.resolve(
          sessionCalls === 1
            ? new Response(JSON.stringify({ code: 'session_expired' }), {
                status: 401,
              })
            : new Response(
                JSON.stringify({ state: 'anonymous', csrf: 'fresh-csrf' }),
              ),
        )
      }
      expect(window.location.hash).toBe('')
      expect(url).toContain('/password-reset/inspect')
      return Promise.resolve(
        new Response(JSON.stringify({ email: 'ordinary@example.test' })),
      )
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/reset-password'] }),
      )}
    />,
  )
  expect(
    await screen.findByDisplayValue('ordinary@example.test'),
  ).toHaveAttribute('readonly')
  expect(sessionCalls).toBeGreaterThanOrEqual(2)
  expect(window.location.hash).toBe('')
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/auth/password-reset/inspect',
    expect.objectContaining({
      body: JSON.stringify({
        selector: 'fixture-selector',
        verifier: 'fixture-verifier',
      }),
      headers: expect.objectContaining({ 'X-CSRF-Token': 'fresh-csrf' }),
    }),
  )
})

test('late reset inspection cannot restore proof state after navigation', async () => {
  window.history.replaceState(
    {},
    '',
    '/reset-password#selector=fixture-selector&verifier=fixture-verifier',
  )
  let finishInspection
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url) => {
      if (url.endsWith('/session'))
        return Promise.resolve(
          new Response(JSON.stringify({ state: 'anonymous', csrf: 'fixture' })),
        )
      if (url.endsWith('/inspect'))
        return new Promise((resolve) => {
          finishInspection = resolve
        })
      throw new Error(`Unexpected request: ${url}`)
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/reset-password'] }),
  )
  render(<App router={router} />)
  await waitFor(() => expect(finishInspection).toBeTypeOf('function'))
  await act(() => router.navigate({ to: '/login' }))
  await act(() =>
    finishInspection(
      new Response(JSON.stringify({ email: 'late-private@example.test' })),
    ),
  )
  expect(
    await screen.findByRole('heading', { name: 'Connexion à votre espace' }),
  ).toBeVisible()
  expect(
    screen.queryByDisplayValue('late-private@example.test'),
  ).not.toBeInTheDocument()
})

test('late reset completion cannot restore state after account navigation', async () => {
  window.history.replaceState(
    {},
    '',
    '/reset-password#selector=fixture-selector&verifier=fixture-verifier',
  )
  let finishCompletion
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url) => {
      if (url.endsWith('/session'))
        return Promise.resolve(
          new Response(JSON.stringify({ state: 'anonymous', csrf: 'fixture' })),
        )
      if (url.endsWith('/inspect'))
        return Promise.resolve(
          new Response(JSON.stringify({ email: 'ordinary@example.test' })),
        )
      if (url.endsWith('/complete'))
        return new Promise((resolve) => {
          finishCompletion = resolve
        })
      throw new Error(`Unexpected request: ${url}`)
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/reset-password'] }),
  )
  render(<App router={router} />)
  await userEvent.type(
    await screen.findByLabelText('Nouveau mot de passe'),
    'Recovered!94',
  )
  await userEvent.type(
    screen.getByLabelText('Confirmer le mot de passe'),
    'Recovered!94',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }),
  )
  await waitFor(() => expect(finishCompletion).toBeTypeOf('function'))
  await act(() => router.navigate({ to: '/login' }))
  await act(() =>
    finishCompletion(new Response(JSON.stringify({ state: 'password_reset' }))),
  )
  expect(
    await screen.findByRole('heading', { name: 'Connexion à votre espace' }),
  ).toBeVisible()
  expect(
    screen.queryByText('Votre mot de passe a été réinitialisé.'),
  ).not.toBeInTheDocument()
  expect(
    router.options.context.queryClient.getMutationCache().getAll(),
  ).toHaveLength(0)
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
