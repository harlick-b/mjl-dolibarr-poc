import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Urls } from '@/app/urls'
import { PwaUpdate } from './PwaUpdate'

const state = vi.hoisted(() => ({
  onNeedReload: null,
  update: vi.fn(),
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options) => {
    state.onNeedReload = options.onNeedReload
    return {
      needRefresh: [true, vi.fn()],
      updateServiceWorker: state.update,
    }
  },
}))

afterEach(() => {
  state.onNeedReload = null
  state.update.mockReset()
})

test('a waiting application update activates without showing a prompt and opens login', async () => {
  const openLogin = vi.fn()
  render(<PwaUpdate onActivated={openLogin} />)

  expect(
    screen.queryByText('Une nouvelle version est disponible.', {
      exact: false,
    }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Actualiser l’application' }),
  ).not.toBeInTheDocument()
  await waitFor(() => expect(state.update).toHaveBeenCalledWith(true))

  act(() => state.onNeedReload())
  expect(openLogin).toHaveBeenCalledWith(Urls.logout)
})
