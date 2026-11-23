import { useState } from 'react'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Modal } from '@/shared/ui/BusinessModal'
import { Button } from '@/shared/ui/button'
import { DatePicker } from '@/shared/ui/DatePicker'
import { ExactNumberInput } from '@/shared/ui/ExactNumberInput'
import { formatDate, formatXof } from '@/shared/lib/format'
import { strings } from '@/locales/fr/PlanningView'
import { strings as ptaStrings } from '@/locales/fr/PTAModal'
import { buildActivityWorkflowRequest } from '../lib/activity-workflow-request'

const reviewedActions = ['prevalidate', 'approve']
const reasonActions = [
  'return',
  'open_amendment',
  'cancel_amendment',
  'request_withdrawal',
  'cancel_withdrawal',
  'request_transfer',
  'cancel_transfer',
]
const cancellationActions = [
  'cancel_amendment',
  'cancel_withdrawal',
  'cancel_transfer',
]

export function ActivityWorkflowDialog({
  action,
  item,
  user,
  blocked,
  opener,
  onClose,
  onSubmit,
}) {
  const [transferTargetYear, setTransferTargetYear] = useState(
    item.transfer?.target_year || '',
  )
  const [transferStart, setTransferStart] = useState('')
  const [transferEnd, setTransferEnd] = useState('')
  const [transferTasks, setTransferTasks] = useState([])
  const [requestedAmount, setRequestedAmount] = useState('')
  const transferDatesValid = validTransferDates(
    transferTasks,
    transferStart,
    transferEnd,
  )

  const submit = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await onSubmit(
      buildActivityWorkflowRequest({
        action,
        item,
        reason: data.get('reason'),
        requestedAmount: data.get('requested_amount'),
        plannedStart: data.get('planned_start'),
        plannedEnd: data.get('planned_end'),
        transferTasks,
      }),
    )
    onClose()
  }

  return (
    <Modal
      open={Boolean(action)}
      className="[&>header]:sticky [&>header]:top-0 [&>header]:z-10 [&>header]:bg-white"
      onClose={onClose}
      label={dialogLabel(action)}
      opener={opener}
    >
      <BusinessForm
        className="grid gap-4 min-w-[min(520px,_calc(100vw_-_40px))] p-6 [@media(min-height:601px)]:[&_footer]:sticky [@media(min-height:601px)]:[&_footer]:bottom-0 [&_footer]:z-10 [&_footer]:bg-white [&_footer]:flex [&_footer]:justify-end [&_footer]:gap-2"
        onSubmit={submit}
      >
        {!reviewedActions.includes(action) && (
          <p>{strings.workflowExactRevision}</p>
        )}
        {reviewedActions.includes(action) && (
          <>
            <p className="font-medium">{item.name}</p>
            <div className="flex items-center justify-between gap-6 border-b border-border pb-4 text-sm">
              <span className="text-muted-foreground">
                {strings.plannedAmountSummary}
              </span>
              <strong>{formatXof(item.allocation)}</strong>
            </div>
            <label>
              {strings.observation}
              <textarea name="reason" maxLength="4000" autoFocus />
            </label>
          </>
        )}
        {reasonActions.includes(action) && (
          <>
            {cancellationActions.includes(action) && (
              <p>{strings.cancellationWarning}</p>
            )}
            <label>
              {reasonLabel(action)} *
              <textarea name="reason" required maxLength="4000" autoFocus />
            </label>
            {action === 'request_transfer' && (
              <TransferFields
                item={item}
                targetYear={transferTargetYear}
                start={transferStart}
                end={transferEnd}
                tasks={transferTasks}
                onStart={(value) => {
                  setTransferStart(value)
                  setTransferTasks(
                    shiftedTransferTasks(item.tasks, item.planned_start, value),
                  )
                  setTransferTargetYear(value ? Number(value.slice(0, 4)) : '')
                }}
                onEnd={setTransferEnd}
              />
            )}
            {action === 'return' &&
              user.role === 'VALIDATEUR_DEFINITIF' &&
              !item.withdrawal &&
              !item.transfer && (
                <label>
                  {strings.requestedAmount}
                  <ExactNumberInput
                    name="requested_amount"
                    value={requestedAmount}
                    onChange={setRequestedAmount}
                    suffix="F CFA"
                  />
                </label>
              )}
          </>
        )}
        <footer data-ui="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {strings.cancel}
          </Button>
          <Button
            type="submit"
            disabled={
              blocked ||
              (action === 'request_transfer' &&
                (!transferStart ||
                  !transferEnd ||
                  transferEnd < transferStart ||
                  !transferDatesValid))
            }
          >
            {action === 'prevalidate'
              ? strings.prevalidateAndSend
              : action === 'approve'
                ? strings.approveActivity
                : strings.confirm}
          </Button>
        </footer>
      </BusinessForm>
    </Modal>
  )
}

function TransferFields({
  item,
  targetYear,
  start,
  end,
  tasks,
  onStart,
  onEnd,
}) {
  return (
    <>
      <div className="flex gap-8 flex-wrap [&_dt]:text-muted-foreground [&_dt]:text-[0.8125rem]">
        <div>
          <strong>{strings.sourceAnnualPlan}</strong> {item.placement_year}
        </div>
        <div>
          <strong>{strings.targetAnnualPlan}</strong>{' '}
          {targetYear || strings.chooseStartDate}
        </div>
        <div>
          <strong>{strings.unchangedBudget}</strong>{' '}
          {formatXof(item.allocation)}
        </div>
      </div>
      <p>{strings.unchangedOperations}</p>
      <p className="text-sm text-muted-foreground">{ptaStrings.required}</p>
      <ul
        className="grid gap-0 p-0 list-none [&_li]:min-h-13 [&_li]:border-t [&_li]:border-t-border [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4"
        data-ui="planning-list"
      >
        {(item.tasks || []).map((task) => (
          <li key={task.id}>
            {task.name}
            <span>{formatXof(task.allocation)}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(min(100%,_18rem),_1fr))] gap-4 my-5">
        <label>
          {strings.targetStart} *
          <DatePicker
            name="planned_start"
            label={strings.targetStart}
            value={start}
            onChange={onStart}
          />
          <input type="hidden" name="planned_start" value={start} />
        </label>
        <label>
          {strings.targetEnd} *
          <DatePicker
            label={strings.targetEnd}
            value={end}
            min={start || undefined}
            onChange={onEnd}
          />
          <input type="hidden" name="planned_end" value={end} />
        </label>
      </div>
      {start && (
        <ul className="grid gap-3 p-0 list-none">
          {(item.tasks || []).map((task, taskIndex) => {
            const dates = tasks[taskIndex]
            return (
              <li key={task.id} className="rounded-card border p-3">
                <strong>{task.name}</strong>
                <p className="text-sm text-muted-foreground">
                  {dateRange(dates)}
                </p>
                {(task.subtasks || []).map((child, childIndex) => (
                  <p key={child.id} className="text-sm">
                    {child.name}: {dateRange(dates?.subtasks[childIndex])}
                  </p>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function dialogLabel(action) {
  if (action === 'prevalidate') return strings.prevalidationConfirmation
  if (action === 'approve') return strings.approvalConfirmation
  return strings.workflowConfirmation
}

function reasonLabel(action) {
  if (action === 'open_amendment') return strings.amendmentReason
  if (cancellationActions.includes(action)) return strings.cancellationReason
  if (action === 'request_withdrawal') return strings.withdrawalReason
  if (action === 'request_transfer') return strings.transferReason
  return strings.reason
}

function dateRange(value) {
  return value?.planned_start && value?.planned_end
    ? `${formatDate(value.planned_start)} – ${formatDate(value.planned_end)}`
    : strings.dateUnknown
}

function validTransferDates(tasks, start, end) {
  return tasks.every((task) => {
    if (!task.planned_start && !task.planned_end)
      return task.subtasks.every(
        (child) => !child.planned_start && !child.planned_end,
      )
    if (
      !task.planned_start ||
      !task.planned_end ||
      task.planned_start < start ||
      task.planned_end > end
    )
      return false
    return task.subtasks.every(
      (child) =>
        (!child.planned_start && !child.planned_end) ||
        (child.planned_start &&
          child.planned_end &&
          child.planned_start >= task.planned_start &&
          child.planned_end <= task.planned_end),
    )
  })
}

function shiftedTransferTasks(tasks, sourceStart, targetStart) {
  if (!sourceStart || !targetStart) return []
  const dayDelta = Math.round(
    (Date.parse(`${targetStart}T00:00:00Z`) -
      Date.parse(`${sourceStart}T00:00:00Z`)) /
      86_400_000,
  )
  return (tasks || []).map((task) => ({
    id: task.id,
    planned_start: shiftTransferDate(task.planned_start, dayDelta),
    planned_end: shiftTransferDate(task.planned_end, dayDelta),
    subtasks: (task.subtasks || []).map((child) => ({
      id: child.id,
      planned_start: shiftTransferDate(child.planned_start, dayDelta),
      planned_end: shiftTransferDate(child.planned_end, dayDelta),
    })),
  }))
}

function shiftTransferDate(value, dayDelta) {
  if (!value) return null
  const shifted = new Date(`${value}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + dayDelta)
  return shifted.toISOString().slice(0, 10)
}
