import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from '@/features/auth/SessionProvider'
import { RestClientProvider } from '@/shared/api/RestClientProvider'
import { ActivityBriefModal } from './ActivityBriefModal'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})
function setup(post, extra = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(['auth', 'session'], {
    state: 'verified',
    user: { id: 'reviewer' },
    csrf: 'csrf',
  })
  const saved = vi.fn()
  const api = {
    request: vi.fn(async (_path, options) =>
      options?.method === 'POST'
        ? (post?.(options) ?? { id: 'activity-1' })
        : {
            object: 'list',
            count: 1,
            data: [
              {
                id: 'agent-1',
                full_name: 'Aïcha HOUNKPATIN',
                email: 'a@example.test',
              },
            ],
            next: null,
            previous: null,
          },
    ),
  }
  const rendered = render(
    <QueryClientProvider client={client}>
      <RestClientProvider client={api}>
        <SessionProvider>
          <ActivityBriefModal
            context={{
              year: 2027,
              pta: { name: 'PTA annuel' },
              project: { id: 'project-1' },
            }}
            onClose={() => {}}
            onSaved={saved}
            {...extra}
          />
        </SessionProvider>
      </RestClientProvider>
    </QueryClientProvider>,
  )
  return { ...rendered, api, saved, client }
}

async function fillBrief() {
  const user = userEvent.setup()
  await user.type(
    screen.getByLabelText('Intitulé de l’activité *'),
    'Concertation communale',
  )
  await user.click(screen.getByRole('button', { name: /Date de début/ }))
  const calendar = screen.getByRole('grid')
  await user.click(
    within(calendar).getByRole('button', { name: /vendredi 1 janvier 2027/i }),
  )
  await user.click(
    screen.getByRole('button', { name: /Sélectionner des Agents/ }),
  )
  await user.click(
    await screen.findByRole('option', { name: 'Aïcha HOUNKPATIN' }),
  )
  return user
}

test('reviewer assigns a brief without inventing an end date, operations or budget', async () => {
  const { api, saved } = setup()
  await waitFor(() =>
    expect(api.request).toHaveBeenCalledWith(
      '/api/v1/assignment-agents?limit=10',
      expect.any(Object),
    ),
  )
  const user = await fillBrief()
  await user.click(screen.getByRole('button', { name: 'Créer l’activité' }))
  await waitFor(() => expect(saved).toHaveBeenCalled())
  const call = api.request.mock.calls.find(([, o]) => o?.method === 'POST')
  expect(call[1].body).toEqual({
    name: 'Concertation communale',
    description: '',
    planned_start: '2027-01-01',
    planned_end: null,
    agent_ids: ['agent-1'],
    request_key: expect.any(String),
  })
})

test('unknown creation retries the identical command and freezes the draft', async () => {
  const post = vi
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new Error('lost'), { kind: 'network' }),
    )
    .mockRejectedValueOnce(
      Object.assign(new Error('unavailable'), { status: 503 }),
    )
    .mockResolvedValue({ id: 'saved' })
  const { saved } = setup(post)
  const user = await fillBrief()
  await user.click(screen.getByRole('button', { name: 'Créer l’activité' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Intitulé de l’activité *')).toBeDisabled()
  await user.click(
    screen.getByRole('button', { name: 'Vérifier l’enregistrement' }),
  )
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect(saved).not.toHaveBeenCalled()
  await user.click(
    screen.getByRole('button', { name: 'Vérifier l’enregistrement' }),
  )
  await waitFor(() => expect(saved).toHaveBeenCalled())
  expect(post.mock.calls[1][0].body).toEqual(post.mock.calls[0][0].body)
  expect(post.mock.calls[2][0].body).toEqual(post.mock.calls[0][0].body)
})

test('a conclusive retry failure unlocks the retained draft for correction', async () => {
  const post = vi
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new Error('lost'), { kind: 'network' }),
    )
    .mockRejectedValueOnce(
      Object.assign(new Error('ineligible'), {
        status: 409,
        code: 'assignment_ineligible',
      }),
    )
  setup(post)
  const user = await fillBrief()
  await user.click(screen.getByRole('button', { name: 'Créer l’activité' }))
  await user.click(
    await screen.findByRole('button', { name: 'Vérifier l’enregistrement' }),
  )
  await waitFor(() =>
    expect(screen.getByLabelText('Intitulé de l’activité *')).toBeEnabled(),
  )
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Un Agent sélectionné n’est plus disponible',
  )
  expect(screen.getByRole('button', { name: 'Créer l’activité' })).toBeEnabled()
})

test('a rate limit during recovery keeps the same command frozen', async () => {
  const post = vi
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new Error('lost'), { kind: 'network' }),
    )
    .mockRejectedValueOnce(
      Object.assign(new Error('limited'), {
        status: 429,
        code: 'endpoint_limited',
      }),
    )
    .mockResolvedValue({ id: 'saved' })
  const { saved } = setup(post)
  const user = await fillBrief()
  await user.click(screen.getByRole('button', { name: 'Créer l’activité' }))
  await user.click(
    await screen.findByRole('button', { name: 'Vérifier l’enregistrement' }),
  )
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect(screen.getByLabelText('Intitulé de l’activité *')).toBeDisabled()
  await user.click(
    screen.getByRole('button', { name: 'Vérifier l’enregistrement' }),
  )
  await waitFor(() => expect(saved).toHaveBeenCalled())
  expect(post.mock.calls[1][0].body).toEqual(post.mock.calls[0][0].body)
  expect(post.mock.calls[2][0].body).toEqual(post.mock.calls[0][0].body)
})

test('dismissing an in-flight write retains recovery and still invalidates on success', async () => {
  let finish
  const close = vi.fn()
  const { client, saved } = setup(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
    { onClose: close },
  )
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const user = await fillBrief()
  await user.click(screen.getByRole('button', { name: 'Créer l’activité' }))
  await user.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(close).toHaveBeenCalledWith(true)
  finish({ id: 'created' })
  await waitFor(() => expect(saved).toHaveBeenCalled())
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['planning', 'reviewer'],
  })
})
