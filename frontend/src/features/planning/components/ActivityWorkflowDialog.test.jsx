import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useRef, useState } from 'react'
import { ActivityWorkflowDialog } from './ActivityWorkflowDialog'

const item = {
  id: 'activity-1',
  name: 'Atelier approuvé',
  allocation: '100000',
  version: 4,
  current_revision_id: 'revision-1',
  approved_revision_id: 'revision-1',
  placement_year: 2027,
  planned_start: '2027-01-10',
  amendment: { id: 'amendment-1' },
  withdrawal: { id: 'withdrawal-1' },
  transfer: { id: 'transfer-1' },
  tasks: [
    {
      id: 'task-1',
      name: 'Préparer',
      allocation: '100000',
      planned_start: '2027-01-10',
      planned_end: '2027-04-10',
      subtasks: [],
    },
  ],
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})

afterEach(() => {
  delete HTMLDialogElement.prototype.showModal
  delete HTMLDialogElement.prototype.close
})

function FocusHarness() {
  const [action, setAction] = useState('')
  const opener = useRef(null)
  return (
    <>
      <button ref={opener} onClick={() => setAction('cancel_amendment')}>
        Ouvrir
      </button>
      <ActivityWorkflowDialog
        key={action}
        action={action}
        item={item}
        user={{ role: 'AGENT_SAISIE' }}
        opener={opener}
        onSubmit={vi.fn()}
        onClose={() => setAction('')}
      />
    </>
  )
}

test('submits an amendment cancellation and closes after success', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue({})
  const onClose = vi.fn()
  render(
    <ActivityWorkflowDialog
      action="cancel_amendment"
      item={item}
      user={{ role: 'AGENT_SAISIE' }}
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  )

  await user.type(screen.getByLabelText('Motif de l’annulation *'), 'Retour')
  await user.click(screen.getByRole('button', { name: 'Confirmer' }))

  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({
      path: '/activities/activity-1/amendments/amendment-1/cancellation',
      method: 'POST',
      body: {
        expected_version: 4,
        expected_approved_revision_id: 'revision-1',
        reason: 'Retour',
      },
    }),
  )
  expect(onClose).toHaveBeenCalledOnce()
})

test('retains a failed amendment draft and only closes after a successful retry', async () => {
  const user = userEvent.setup()
  let finishRetry
  const retry = new Promise((resolve) => {
    finishRetry = resolve
  })
  const onSubmit = vi
    .fn()
    .mockRejectedValueOnce(new Error('request failed'))
    .mockReturnValueOnce(retry)
  const onClose = vi.fn()
  render(
    <ActivityWorkflowDialog
      action="open_amendment"
      item={item}
      user={{ role: 'AGENT_SAISIE' }}
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  )

  const reason = screen.getByLabelText('Motif de la modification *')
  const confirm = screen.getByRole('button', { name: 'Confirmer' })
  await user.type(reason, 'Adapter le calendrier')
  await user.click(confirm)

  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(reason).toHaveValue('Adapter le calendrier')
  expect(onClose).not.toHaveBeenCalled()

  await user.click(confirm)
  await waitFor(() => expect(confirm).toHaveAttribute('aria-busy', 'true'))
  expect(screen.getByRole('button', { name: 'Annuler' })).not.toHaveAttribute(
    'aria-busy',
  )
  finishRetry({})

  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
})

test('returns focus to the action that opened the dialog', async () => {
  const user = userEvent.setup()
  render(<FocusHarness />)

  const opener = screen.getByRole('button', { name: 'Ouvrir' })
  await user.click(opener)
  await user.click(screen.getByRole('button', { name: 'Annuler' }))

  await waitFor(() => expect(opener).toHaveFocus())
})

test('submits withdrawal cancellation with the frozen revision', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue({})
  render(
    <ActivityWorkflowDialog
      action="cancel_withdrawal"
      item={item}
      user={{ role: 'AGENT_SAISIE' }}
      onSubmit={onSubmit}
      onClose={() => {}}
    />,
  )

  await user.type(screen.getByLabelText('Motif de l’annulation *'), 'Conserver')
  await user.click(screen.getByRole('button', { name: 'Confirmer' }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      path: '/activities/activity-1/withdrawals/withdrawal-1/cancellation',
      body: expect.objectContaining({ expected_revision_id: 'revision-1' }),
    }),
  )
})

test('keeps transfer confirmation disabled until dates are valid', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue({})
  render(
    <ActivityWorkflowDialog
      action="request_transfer"
      item={{ ...item, transfer: null }}
      user={{ role: 'AGENT_SAISIE' }}
      onSubmit={onSubmit}
      onClose={() => {}}
    />,
  )

  await user.type(screen.getByLabelText('Motif du transfert *'), 'Reporter')
  const confirm = screen.getByRole('button', { name: 'Confirmer' })
  expect(confirm).toBeDisabled()
  await user.click(
    screen.getByRole('button', { name: /Nouvelle date de début/ }),
  )
  fireEvent.change(
    screen.getByLabelText('Nouvelle date de début', { selector: 'input' }),
    {
      target: { value: '2028-02-01' },
    },
  )
  await user.click(screen.getByRole('button', { name: /Nouvelle date de fin/ }))
  fireEvent.change(
    screen.getByLabelText('Nouvelle date de fin', { selector: 'input' }),
    {
      target: { value: '2028-08-31' },
    },
  )
  expect(confirm).toBeEnabled()
  await user.click(confirm)

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      path: '/activities/activity-1/transfers',
      body: expect.objectContaining({
        planned_start: '2028-02-01',
        planned_end: '2028-08-31',
        tasks: [
          {
            id: 'task-1',
            planned_start: '2028-02-01',
            planned_end: '2028-05-01',
            subtasks: [],
          },
        ],
      }),
    }),
  )
})
