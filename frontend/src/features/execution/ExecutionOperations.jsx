import { useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, CircleDollarSign, Play } from 'lucide-react'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Button } from '@/shared/ui/button'
import { ExactNumberInput } from '@/shared/ui/ExactNumberInput'
import { formatDate, formatDateTime, formatXof } from '@/shared/lib/format'
import { strings } from '@/locales/fr/ExecutionView'

function canRecord(item) {
  return item.allowed_actions.includes('record')
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
                        ? ` · ${task.subtasks.length} sous-tâche(s)`
                        : ''}
                    </small>
                  </td>
                  <td className="p-3">
                    <strong>
                      {task.progress === null
                        ? '—'
                        : `${String(task.progress).replace('.', ',')} %`}
                    </strong>
                    <small className="mt-1 block text-muted-foreground">
                      {stateLabel(task)}
                    </small>
                  </td>
                  <td className="p-3 text-right">
                    {formatXof(task.approved_allocation)}
                  </td>
                  <td className="p-3 text-right">
                    {formatXof(task.actual_spent)}
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
                        {isExpanded ? 'Masquer' : 'Afficher'}
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
                      {formatXof(child.actual_spent)}
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
        <span>Montant prévu</span>
        <strong className="font-semibold text-navy">
          {formatXof(target.approved_allocation)}
        </strong>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Début prévu</dt>
          <dd className="mt-1 font-medium">
            {target.planned_start ? formatDate(target.planned_start) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fin prévue</dt>
          <dd className="mt-1 font-medium">
            {target.planned_end ? formatDate(target.planned_end) : '—'}
          </dd>
        </div>
      </dl>
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
            {strings.recordedExpense}
            <ExactNumberInput
              name="actual_spent"
              value={amount}
              onChange={setAmount}
              suffix="F CFA"
              aria-label={strings.recordedExpense}
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
