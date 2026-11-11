import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import { ActivityForm } from '@/features/planning/pages/PlanningView'
import { PwaUpdate } from './PwaUpdate'

const { update } = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, vi.fn()],
    updateServiceWorker: update,
  }),
}))
afterEach(() => update.mockClear())

test('application updates wait for an edited planning form to be saved', async () => {
  const client = new QueryClient()
  let finishSave
  render(
    <>
      <ActivityForm
        types={[]}
        initial={{
          version: 1,
          name: 'Atelier',
          description: 'Description',
          planned_start: '2027-01-01',
          planned_end: '2027-04-01',
          operations: [],
        }}
        onSubmit={() =>
          new Promise((resolve) => {
            finishSave = resolve
          })
        }
      />
      <PwaUpdate queryClient={client} />
    </>,
  )
  fireEvent.change(
    screen.getByLabelText('Intitulé de l’activité *', { exact: true }),
    {
      target: { value: 'Atelier modifié' },
    },
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Actualiser l’application' }),
  )
  expect(update).not.toHaveBeenCalled()
  fireEvent.submit(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }).form,
  )
  expect(
    screen.getByLabelText('Intitulé de l’activité *', { exact: true }),
  ).toBeDisabled()
  fireEvent.click(
    screen.getByRole('button', { name: 'Actualiser l’application' }),
  )
  expect(update).not.toHaveBeenCalled()
  await act(async () => finishSave())
  expect(
    screen.getByLabelText('Intitulé de l’activité *', { exact: true }),
  ).toBeEnabled()
  fireEvent.click(
    screen.getByRole('button', { name: 'Actualiser l’application' }),
  )
  expect(update).toHaveBeenCalledWith(true)
})

test('application updates wait for pending business mutations', async () => {
  const client = new QueryClient()
  let finish
  const mutation = client.getMutationCache().build(client, {
    mutationFn: () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  })
  const request = mutation.execute()
  await act(async () => Promise.resolve())
  render(<PwaUpdate queryClient={client} />)
  fireEvent.click(
    screen.getByRole('button', { name: 'Actualiser l’application' }),
  )
  expect(update).not.toHaveBeenCalled()
  await act(async () => {
    finish()
    await request
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Actualiser l’application' }),
  )
  expect(update).toHaveBeenCalledWith(true)
})
