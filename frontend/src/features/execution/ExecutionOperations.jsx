import { useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, CircleDollarSign, Play } from 'lucide-react'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Button } from '@/shared/ui/button'
import { ExactNumberInput } from '@/shared/ui/ExactNumberInput'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { formatDateTime, formatXof } from '@/shared/lib/format'
import { strings } from '@/locales/fr/ExecutionView'

function canRecord(item) {
  return item.allowed_actions.includes('record')
}

function stateLabel(item) {
  if (item.execution_completed) return strings.completedLabel
  if (item.execution_started_at) return strings.ongoingLabel
  return strings.notStartedLabel
}

export function ExecutionTasks({ detail, onSelect }) {
  const [isOpen, setIsOpen] = useState(!detail.works_completed)
  return (
    <details
      className="group overflow-hidden rounded-panel border border-border bg-white"
      open={isOpen}
    >
      <summary
        className={`flex min-h-20 cursor-pointer list-none flex-wrap items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden ${detail.works_completed ? 'bg-white' : 'bg-selected'}`}
        onClick={(event) => {
          event.preventDefault()
          setIsOpen((current) => !current)
        }}
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-primary text-xs font-semibold text-primary">
          {detail.works_completed ? '✓' : '•'}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block font-semibold text-navy">
            {strings.physicalProgress}
          </strong>
          <span className="text-sm text-muted-foreground">
            {detail.progress === null
              ? strings.progressUnavailable
              : `${detail.progress} %`}
          </span>
          <span className="block text-sm text-muted-foreground">
            {detail.tasks.filter((task) => task.actual_spent !== null).length} /{' '}
            {detail.tasks.length}{' '}
            {detail.tasks.length === 1
              ? strings.expenseRecorded
              : strings.expensesRecorded}
          </span>
          <span className="block text-sm text-muted-foreground">
            {detail.completed_tasks} / {detail.task_count} tâches terminées
          </span>
        </span>
        <StatusBadge className="bg-white text-primary">
          {detail.works_completed ? strings.completedLabel : strings.toProcess}
        </StatusBadge>
        <ChevronDown
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          size={18}
        />
      </summary>
      <div className="overflow-x-auto p-5">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="p-3 text-left font-medium">{strings.task}</th>
              <th className="p-3 text-right font-medium">{strings.weight}</th>
              <th className="p-3 text-right font-medium">
                {strings.authorized}
              </th>
              <th className="p-3 text-right font-medium">{strings.spent}</th>
              <th className="p-3 text-left font-medium">
                {strings.realization}
              </th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {detail.tasks.flatMap((task) => {
              const rows = [
                <tr key={task.id} className="border-b border-border">
                  <td className="p-3 font-medium">
                    {task.name}
                    <small className="mt-1 block text-muted-foreground">
                      {task.type_label}
                    </small>
                  </td>
                  <td className="p-3 text-right">
                    {task.weight ? `${task.weight} %` : '—'}
                  </td>
                  <td className="p-3 text-right">
                    {formatXof(task.approved_allocation)}
                  </td>
                  <td className="p-3 text-right">
                    {formatXof(task.actual_spent)}
                  </td>
                  <td className="p-3">
                    {task.progress ? `${task.progress} %` : stateLabel(task)}
                  </td>
                  <td className="p-3 text-right">
                    {!task.subtasks.length && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`${canRecord(task) ? strings.record : strings.consult} ${task.name}`}
                        onClick={(event) =>
                          onSelect(task.id, null, event.currentTarget)
                        }
                      >
                        {canRecord(task) ? strings.record : strings.consult}
                      </Button>
                    )}
                  </td>
                </tr>,
              ]
              for (const child of task.subtasks)
                rows.push(
                  <tr
                    key={child.id}
                    className="border-b border-border bg-background/50 last:border-0"
                  >
                    <td className="p-3 pl-8">↳ {child.name}</td>
                    <td className="p-3 text-right">{child.weight} %</td>
                    <td className="p-3 text-right">
                      {formatXof(child.approved_allocation)}
                    </td>
                    <td className="p-3 text-right">
                      {formatXof(child.actual_spent)}
                    </td>
                    <td className="p-3">{stateLabel(child)}</td>
                    <td className="p-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`${canRecord(child) ? strings.record : strings.consult} ${child.name}`}
                        onClick={(event) =>
                          onSelect(task.id, child.id, event.currentTarget)
                        }
                      >
                        {canRecord(child) ? strings.record : strings.consult}
                      </Button>
                    </td>
                  </tr>,
                )
              return rows
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function TaskEditor({
  activity,
  task,
  target,
  isSubtask,
  pending,
  mutate,
}) {
  const draftBasis = useRef(null)
  const formRef = useRef(null)
  const [submissionError, setSubmissionError] = useState('')
  const [amount, setAmount] = useState(target.actual_spent ?? '')
  const [progress, setProgress] = useState(target.progress ?? '')
  const correction = Boolean(target.execution_started_at)
  const weightedTask = !isSubtask && target.weight != null
  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">
          {activity.reference} · {activity.name}
        </p>
        {isSubtask && (
          <p className="text-sm">
            {strings.parentTask} : {task.name}
          </p>
        )}
        {task.type_label && (
          <p className="text-sm text-muted-foreground">
            Catégorie : {task.type_label}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-border py-3 text-sm">
        <span>{strings.authorizedAmountLabel}</span>
        <strong className="font-semibold text-navy">
          {formatXof(target.approved_allocation)}
        </strong>
      </div>
      {target.execution_started_at && (
        <p className="flex items-center gap-2 text-sm">
          <Play size={16} /> Démarrée le{' '}
          {formatDateTime(target.execution_started_at)}
        </p>
      )}
      {canRecord(target) && (
        <BusinessForm
          formRef={formRef}
          onReset={() => {
            draftBasis.current = null
            setAmount(target.actual_spent ?? '')
            setProgress(target.progress ?? '')
          }}
          className="grid gap-5 [&_>_label]:w-full"
          onChangeCapture={() => {
            setSubmissionError('')
            draftBasis.current ??= {
              version: activity.version,
              revision: activity.approved_revision_id,
            }
          }}
          onSubmit={async (event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const completed = !weightedTask
              ? data.get('execution_completed') === 'on'
              : Number(progress) === 100
            const observation = String(data.get('execution_observation') || '')
            if (!amount && !completed && !progress && !observation.trim()) {
              setSubmissionError(strings.progressRequired)
              return false
            }
            const body = {
              action: 'record',
              expected_version: draftBasis.current?.version ?? activity.version,
              expected_approved_revision_id:
                draftBasis.current?.revision ?? activity.approved_revision_id,
              actual_spent: amount || null,
              execution_completed: completed,
              execution_observation: observation,
              ...(weightedTask ? { progress: progress || '0.00' } : {}),
            }
            const reason = String(data.get('correction_reason') || '')
            if (reason) body.correction_reason = reason
            const result = await mutate(
              task.id,
              isSubtask ? target.id : null,
              body,
            )
            if (result !== false) draftBasis.current = null
            return result
          }}
        >
          {weightedTask && (
            <label>
              {strings.physicalProgress} *
              <ExactNumberInput
                value={progress}
                onChange={setProgress}
                scale={2}
                suffix="%"
                aria-label={strings.physicalProgress}
              />
            </label>
          )}
          {!weightedTask && (
            <label className="grid-cols-[auto_1fr] items-center min-h-11 [&_input]:size-5">
              <input
                name="execution_completed"
                type="checkbox"
                defaultChecked={target.execution_completed}
              />
              {isSubtask
                ? strings.subtaskCompleted
                : strings.physicallyCompleted}
            </label>
          )}
          <label>
            {strings.actualSpent}
            <ExactNumberInput
              name="actual_spent"
              value={amount}
              onChange={setAmount}
              suffix="F CFA"
              aria-label={strings.actualSpent}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            {strings.progressIndependent}
          </p>
          <label>
            Observation
            <textarea
              name="execution_observation"
              maxLength="4000"
              defaultValue={target.execution_observation}
            />
          </label>
          {correction && (
            <label>
              Motif de la correction *
              <textarea name="correction_reason" required maxLength="4000" />
            </label>
          )}
          {submissionError && (
            <p role="alert" className="text-sm text-destructive">
              {submissionError}
            </p>
          )}
          <div data-ui="modal-actions">
            <Button type="reset" variant="outline" disabled={pending}>
              {strings.cancelEntry}
            </Button>
            <Button type="submit" disabled={pending || !navigator.onLine}>
              {target.execution_completed ? (
                <CheckCircle2 size={16} />
              ) : (
                <CircleDollarSign size={16} />
              )}
              Enregistrer
            </Button>
          </div>
        </BusinessForm>
      )}
    </div>
  )
}
