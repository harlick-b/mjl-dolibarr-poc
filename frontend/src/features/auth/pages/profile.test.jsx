import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router'
import { toast } from 'sonner'

afterEach(() => {
  toast.dismiss()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const profile = {
  full_name: 'Jean de Souza',
  first_name: 'Jean',
  last_name: 'de Souza',
  email: 'actor@example.test',
  role: 'AGENT_SAISIE',
}
function mount(patch, initial = profile) {
  let current = { ...initial }
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options = {}) => {
      if (String(url).endsWith('/auth/profile') && options.method === 'PATCH')
        return patch(options)
      const body = String(url).endsWith('/auth/session')
        ? {
            state: 'verified',
            csrf: 'test',
            user: { id: 'actor', ...profile },
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }
        : String(url).endsWith('/auth/profile')
          ? current
          : { object: 'list', data: [], count: 0, next: null, previous: null }
      return Promise.resolve(new Response(JSON.stringify(body)))
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/profile'] }),
  )
  render(<App router={router} />)
  return {
    router,
    changeServer(value) {
      current = value
    },
  }
}

test('legacy combined names prefill editable fields without changing the original snapshot', async () => {
  let sent
  const legacy = { ...profile, first_name: null, last_name: null }
  mount((options) => {
    sent = JSON.parse(options.body)
    return Promise.resolve(new Response(JSON.stringify(profile)))
  }, legacy)
  expect(await screen.findByLabelText('Prénoms *')).toHaveValue('Jean')
  expect(screen.getByLabelText('Nom *', { exact: true })).toHaveValue(
    'de Souza',
  )
  fireEvent.change(screen.getByLabelText('Prénoms *'), {
    target: { value: 'Jean Paul' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer les modifications' }),
  )
  await waitFor(() =>
    expect(sent?.expected).toEqual({
      full_name: legacy.full_name,
      first_name: null,
      last_name: null,
    }),
  )
})

test('dirty profile retains its original comparison snapshot and explicitly recovers a conflict', async () => {
  let sent
  const { router, changeServer } = mount((options) => {
    sent = JSON.parse(options.body)
    return Promise.resolve(new Response('{}', { status: 409 }))
  })
  fireEvent.change(await screen.findByLabelText('Prénoms *'), {
    target: { value: 'My draft' },
  })
  const updated = {
    ...profile,
    first_name: 'Other',
    full_name: 'Other de Souza',
  }
  changeServer(updated)
  act(() =>
    router.options.context.queryClient.setQueryData(
      ['profile', 'actor'],
      updated,
    ),
  )
  expect(screen.getByLabelText('Prénoms *')).toHaveValue('My draft')
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer les modifications' }),
  )
  await screen.findByRole('alert')
  expect(sent.expected).toEqual({
    full_name: profile.full_name,
    first_name: profile.first_name,
    last_name: profile.last_name,
  })
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Recharger le profil et abandonner mes modifications',
    }),
  )
  await waitFor(() =>
    expect(screen.getByLabelText('Prénoms *')).toHaveValue('Other'),
  )
})

test('leaving profile aborts saving and ignores its late result', async () => {
  let release, signal
  const { router } = mount((options) => {
    signal = options.signal
    return new Promise((resolve) => {
      release = () =>
        resolve(
          new Response(
            JSON.stringify({ ...profile, full_name: 'Late Result' }),
          ),
        )
    })
  })
  fireEvent.change(await screen.findByLabelText('Prénoms *'), {
    target: { value: 'Late' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer les modifications' }),
  )
  await waitFor(() => expect(release).toBeTypeOf('function'))
  await act(() => router.navigate({ to: '/dashboard' }))
  expect(signal.aborted).toBe(true)
  await act(async () => release())
  expect(
    router.options.context.queryClient.getQueryData(['profile', 'actor'])
      .full_name,
  ).toBe(profile.full_name)
  expect(
    screen.queryByText('Votre profil a été mis à jour.'),
  ).not.toBeInTheDocument()
})
