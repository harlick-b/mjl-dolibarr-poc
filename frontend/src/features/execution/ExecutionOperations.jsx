import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Button } from '@/shared/ui/button'
import { ExactNumberInput } from '@/shared/ui/ExactNumberInput'
import {
  formatDate,
  formatExactPercentage,
  formatXof,
} from '@/shared/lib/format'
import { strings } from '@/locales/fr/ExecutionView'

function canRecord(item) {
  return item.allowed_actions.includes('record')
}

function normalizeNumericValue(value, scale = 0) {
  const source = String(value ?? '').trim()
  const match = /^(\d+)(?:\.(\d*))?$/.exec(source)
  if (!match || match[2]?.length > scale) return source
  const fraction = (match[2] || '').padEnd(scale, '0')
  return `${BigInt(match[1]) * 10n ** BigInt(scale) + BigInt(fraction || '0')}`
}

function stateLabel(item) {
  if (item.execution_completed) return strings.completedLabel
  if (item.execution_started_at) return strings.ongoingLabel
  return strings.notStartedLabel
}

export function ExecutionTasks({ detail, onSelect, embedded = false }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const actionLabel = (item, compact = false) => {
    if (!canRecord(item)) return strings.consult
    if (item.execution_started_at || item.actual_spent !== null)
      return compact ? 'Modifier' : 'Modifier la réalisation'
    return strings.record
  }
  return (
    <section
      className={
        embedded
          ? 'overflow-hidden border-t border-border bg-white'
          : 'overflow-hidden rounded-panel border border-border bg-white'
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-210 table-fixed text-[0.8125rem]">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[14%]" />
            <col className="w-[17%]" />
            <col className="w-[17%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="p-3 text-left font-medium">Tâche / période</th>
              <th className="p-3 text-left font-medium">Réalisation</th>
              <th className="p-3 text-right font-medium">Prévu</th>
              <th className="p-3 text-right font-medium">Enregistré</th>
              <th className="p-3 text-right font-medium">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {detail.tasks.flatMap((task) => {
              const isExpanded = expanded.has(task.id)
              const rows = [
                <tr key={task.id} className="border-b border-border">
                  <td className="p-3 font-medium">
                    {task.name}
                    <small className="mt-1 block text-muted-foreground">
                      {task.type_label}
                      {task.planned_start && task.planned_end
                        ? ` · ${formatDate(task.planned_start)} → ${formatDate(task.planned_end)}`
                        : ''}
                      {task.subtasks.length
                        ? ` · ${task.subtasks.length} ${task.subtasks.length === 1 ? 'sous-tâche' : 'sous-tâches'}`
                        : ''}
                    </small>
                  </td>
                  <td className="p-3">
                    <strong>
                      {task.progress === null
                        ? '—'
                        : formatExactPercentage(task.progress)}
                    </strong>
                    <small className="mt-1 block text-muted-foreground">
                      {stateLabel(task)}
                    </small>
                  </td>
                  <td className="p-3 text-right">
                    {formatXof(task.approved_allocation)}
                  </td>
                  <td className="p-3 text-right">
                    {task.actual_spent === null
                      ? 'Non renseigné'
                      : formatXof(task.actual_spent)}
                  </td>
                  <td className="p-3 text-right">
                    {task.subtasks.length ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpanded((current) => {
                            const next = new Set(current)
                            if (next.has(task.id)) next.delete(task.id)
                            else next.add(task.id)
                            return next
                          })
                        }
                      >
                        {isExpanded ? 'Masquer' : 'Développer'}
                        <ChevronDown
                          className={isExpanded ? 'rotate-180' : ''}
                          size={15}
                          aria-hidden="true"
                        />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`${actionLabel(task)} ${task.name}`}
                        onClick={(event) =>
                          onSelect(task.id, null, event.currentTarget)
                        }
                      >
                        {actionLabel(task)}
                      </Button>
                    )}
                  </td>
                </tr>,
              ]
              if (!isExpanded) return rows
              for (const child of task.subtasks)
                rows.push(
                  <tr
                    key={child.id}
                    className="border-b border-border bg-background/50 last:border-0"
                  >
                    <td className="p-3 pl-8">
                      <span aria-hidden="true">↳ </span>
                      {child.name}
                      <small className="mt-1 block text-muted-foreground">
                        {formatDate(child.planned_start)} →{' '}
                        {formatDate(child.planned_end)}
                      </small>
                    </td>
                    <td className="p-3">
                      <strong>
                        {child.execution_completed ? 'Terminée' : 'À réaliser'}
                      </strong>
                    </td>
                    <td className="p-3 text-right">
                      {formatXof(child.approved_allocation)}
                    </td>
                    <td className="p-3 text-right">
                      {child.actual_spent === null
                        ? 'Non renseigné'
                        : formatXof(child.actual_spent)}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`${actionLabel(child, true)} ${child.name}`}
                        onClick={(event) =>
                          onSelect(task.id, child.id, event.currentTarget)
                        }
                      >
                        {actionLabel(child, true)}
                      </Button>
                    </td>
                  </tr>,
                )
              return rows
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function TaskEditor({
  activity,
  task,
  target,
  isSubtask,
  pending,
  mutate,
  onCancel,
}) {
  const draftBasis = useRef(null)
  const [submissionError, setSubmissionError] = useState('')
  const [amount, setAmount] = useState(target.actual_spent ?? '')
  const [progress, setProgress] = useState(target.progress ?? '')
  const [completed, setCompleted] = useState(target.execution_completed)
  const [observation, setObservation] = useState(
    target.execution_observation ?? '',
  )
  const correction = Boolean(target.execution_started_at)
  const weightedTask = !isSubtask && target.weight != null
  const changedExisting =
    correction &&
    (normalizeNumericValue(amount) !==
      normalizeNumericValue(target.actual_spent) ||
      normalizeNumericValue(progress, 2) !==
        normalizeNumericValue(target.progress, 2) ||
      completed !== target.execution_completed ||
      observation.trim() !== (target.execution_observation ?? '').trim())
  const completesExecution = weightedTask ? Number(progress) === 100 : completed
  const period =
    target.planned_start && target.planned_end
      ? target.planned_start === target.planned_end
        ? formatDate(target.planned_start)
        : `${formatDate(target.planned_start)} → ${formatDate(target.planned_end)}`
      : '—'
  return (
    <div className="grid gap-6 p-6">
      <p className="text-sm text-muted-foreground">
        {activity.name}
        {isSubtask ? ` · ${task.name}` : ''}
      </p>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm max-[520px]:grid-cols-1">
        <div>
          <dt className="text-xs text-muted-foreground">Montant prévu</dt>
          <dd className="mt-1 text-base font-medium text-foreground">
            {formatXof(target.approved_allocation)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Période prévue</dt>
          <dd className="mt-1 whitespace-nowrap text-sm font-medium text-foreground">
            {period}
          </dd>
        </div>
      </dl>
      {canRecord(target) && (
        <BusinessForm
          className="grid grid-cols-2 gap-x-4 gap-y-5 max-[520px]:grid-cols-1 [&_>_label]:w-full"
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
            const executionCompleted = completesExecution
            if (!amount && !executionCompleted && !progress) {
              setSubmissionError(strings.progressRequired)
              return false
            }
            const body = {
              action: 'record',
              expected_version: draftBasis.current?.version ?? activity.version,
              expected_approved_revision_id:
                draftBasis.current?.revision ?? activity.approved_revision_id,
              actual_spent: amount || null,
              execution_completed: executionCompleted,
              execution_observation: observation.trim(),
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
              {strings.physicalProgress}
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
            <label className="grid grid-cols-[auto_1fr] items-center self-end min-h-10 [&_input]:size-5">
              <input
                name="execution_completed"
                type="checkbox"
                checked={completed}
                onChange={(event) => setCompleted(event.target.checked)}
              />
              {isSubtask
                ? strings.subtaskCompleted
                : strings.physicallyCompleted}
            </label>
          )}
          <label>
            {strings.recordedExpense}
            <ExactNumberInput
              name="actual_spent"
              value={amount}
              onChange={setAmount}
              suffix="F CFA"
              aria-label={strings.recordedExpense}
            />
          </label>
          <label className="col-span-full">
            Observation
            <textarea
              name="execution_observation"
              maxLength="4000"
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
            />
          </label>
          {changedExisting && (
            <label className="col-span-full">
              Motif de la correction *
              <textarea name="correction_reason" required maxLength="4000" />
            </label>
          )}
          {submissionError && (
            <p role="alert" className="col-span-full text-sm text-destructive">
              {submissionError}
            </p>
          )}
          <div data-ui="modal-actions" className="col-span-full">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onCancel}
            >
              {strings.cancelEntry}
            </Button>
            <Button type="submit" disabled={pending || !navigator.onLine}>
              Enregistrer
            </Button>
          </div>
        </BusinessForm>
      )}
    </div>
  )
}
