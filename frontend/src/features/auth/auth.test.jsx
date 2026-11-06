import { act, render, screen, waitFor } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { App, makeRouter } from '@/app/router'

test('auth feedback belongs only to the page that submitted it', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, options) =>
      options?.method === 'POST'
        ? new Response(JSON.stringify({ code: 'credentials_invalid' }), {
            status: 401,
          })
        : new Response(JSON.stringify({ state: 'anonymous', csrf: 'fixture' })),
    ),
  )
  const router = makeRouter(createMemoryHistory({ initialEntries: ['/login'] }))
  render(<App router={router} />)
  await userEvent.type(
    await screen.findByLabelText('Adresse e-mail'),
    'actor@example.test',
  )
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'Synthetic!93')
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Vérification refusée',
  )
  await userEvent.click(
    screen.getByRole('link', { name: 'Mot de passe oublié ?' }),
  )
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/forgot-password'),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('link', { name: 'Retour à la connexion' }),
  )
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

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
    screen.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }),
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Votre demande a été prise en compte. Consultez votre messagerie pour les instructions de réinitialisation du mot de passe et pensez à vérifier vos courriers indésirables.',
  )
  expect(document.title).toBe('Mot de passe oublié')
  await userEvent.click(
    screen.getByRole('link', { name: 'Retour à la connexion' }),
  )
  await userEvent.click(
    await screen.findByRole('link', { name: 'Mot de passe oublié ?' }),
  )
  expect(await screen.findByLabelText('Adresse e-mail')).toHaveValue('')
  expect(
    screen.queryByText('Votre demande a été prise en compte.', {
      exact: false,
    }),
  ).not.toBeInTheDocument()
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
    await screen.findByRole('heading', { name: 'Connexion' }),
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
    await screen.findByRole('heading', { name: 'Connexion' }),
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

test('OTP fields accept a pasted code and keyboard submission', async () => {
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
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Vérification refusée',
  )
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/auth/otp/verify',
    expect.objectContaining({ body: JSON.stringify({ code: '123456' }) }),
  )
})

test('incorrect credentials keep the login form available for correction', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation((_url, options) =>
        Promise.resolve(
          options.method === 'POST'
            ? new Response('{}', { status: 401 })
            : new Response(
                JSON.stringify({ state: 'anonymous', csrf: 'fixture' }),
              ),
        ),
      ),
  )
  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/login'] }))}
    />,
  )
  await userEvent.type(
    await screen.findByLabelText('Adresse e-mail'),
    'person@example.test',
  )
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'Incorrect!1')
  await userEvent.click(
    screen.getByRole('button', { name: 'Se connecter', exact: true }),
  )
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByLabelText('Mot de passe')).toBeVisible()
  expect(screen.queryByText('Session à vérifier')).not.toBeInTheDocument()
})

test('login fields are locked while credentials are being submitted', async () => {
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
  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/login'] }))}
    />,
  )
  const email = await screen.findByLabelText('Adresse e-mail')
  const password = screen.getByLabelText('Mot de passe')
  await userEvent.type(email, 'person@example.test')
  await userEvent.type(password, 'Synthetic!93')
  await userEvent.click(
    screen.getByRole('button', { name: 'Se connecter', exact: true }),
  )
  expect(email).toBeDisabled()
  expect(password).toBeDisabled()
})

test('completing OTP automatically submits once without Enter or a click', async () => {
  const requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      if (options.method === 'POST') {
        requests.push({ url, body: JSON.parse(options.body) })
        return new Promise(() => {})
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'pending',
            csrf: 'fixture',
            email: 'p***@example.test',
          }),
        ),
      )
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/verification'] }),
      )}
    />,
  )
  await userEvent.click(await screen.findByLabelText('Code de vérification'))
  await userEvent.keyboard('012345')
  expect(requests).toEqual([
    { url: '/api/v1/auth/otp/verify', body: { code: '012345' } },
  ])
  await userEvent.keyboard('{Enter}')
  expect(requests).toHaveLength(1)
  expect(screen.getByLabelText('Chiffre 6 du code')).toBeDisabled()
})

test('login shows progress inside its button while submitting', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url, options) =>
      options?.method === 'POST'
        ? new Promise(() => {})
        : Promise.resolve(
            new Response(
              JSON.stringify({ state: 'anonymous', csrf: 'fixture' }),
            ),
          ),
    ),
  )
  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/login'] }))}
    />,
  )
  await userEvent.type(
    await screen.findByLabelText('Adresse e-mail'),
    'actor@example.test',
  )
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'Synthetic!93')
  const button = screen.getByRole('button', { name: 'Se connecter' })
  await userEvent.click(button)
  await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'))
  expect(button.querySelector('svg')).not.toBeNull()
  expect(button).toBeDisabled()
})

test('a valid reset proof survives an offline and online transition', async () => {
  window.history.replaceState(
    {},
    '',
    '/reset-password#selector=fixture-selector&verifier=fixture-verifier',
  )
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url) =>
        new Response(
          JSON.stringify(
            url.endsWith('/session')
              ? { state: 'anonymous', csrf: 'fixture' }
              : { email: 'ordinary@example.test' },
          ),
        ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/reset-password'] }),
      )}
    />,
  )
  expect(await screen.findByDisplayValue('ordinary@example.test')).toBeVisible()
  expect(window.location.hash).toBe('')
  await act(async () => {
    online.mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
  })
  await act(async () => {
    online.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
  })
  expect(await screen.findByDisplayValue('ordinary@example.test')).toBeVisible()
  expect(
    screen.queryByText('Lien de réinitialisation invalide ou expiré'),
  ).not.toBeInTheDocument()
})
