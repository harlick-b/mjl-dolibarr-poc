import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, CircleDollarSign, Play } from 'lucide-react'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Button } from '@/shared/ui/button'
import { formatDateTime, formatXof } from '@/shared/lib/format'
import { strings } from '@/locales/fr/ExecutionView'
import {
  countRecordedOperations,
  formatFinanceAmount,
} from './executionPresentation'

function canRecordOperation(operation) {
  return operation.allowed_actions.includes('record')
}

export function ExecutionOperations({ detail, onSelect }) {
  const [isOpen, setIsOpen] = useState(!detail.works_completed)
  const recordedOperations = countRecordedOperations(detail.operations)
  return (
    <details
      className="group overflow-hidden rounded-panel border border-border bg-white"
      open={isOpen}
    >
      <summary
        className={`flex min-h-20 cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden ${detail.works_completed ? 'bg-white' : 'bg-selected'}`}
        onClick={(event) => {
          event.preventDefault()
          setIsOpen((current) => !current)
        }}
      >
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${detail.works_completed ? 'border-success text-success' : 'border-primary text-primary'}`}
          aria-hidden="true"
        >
          {detail.works_completed ? '✓' : '•'}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block font-semibold text-navy">
            {strings.physicalProgress}
          </strong>
          <p className="text-sm text-muted-foreground">
            {recordedOperations} / {detail.operation_count}{' '}
            {detail.operation_count === 1
              ? strings.expenseRecorded
              : strings.expensesRecorded}
          </p>
        </span>
        <span className="rounded-card bg-white px-2 py-1 text-xs text-primary">
          {detail.works_completed ? strings.completedLabel : strings.toProcess}
        </span>
        <ChevronDown
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          size={18}
          aria-hidden="true"
        />
      </summary>
      <div className="overflow-x-auto p-5">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="p-3 text-left font-medium">
                {strings.operationType}
              </th>
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
            {detail.operations.map((operation) => (
              <tr
                key={operation.id}
                className="border-b border-border last:border-0"
              >
                <td className="p-3">
                  {operation.name}
                  <small className="mt-1 block text-muted-foreground">
                    {operation.type_label}
                  </small>
                </td>
                <td className="p-3 text-right">
                  {formatXof(operation.approved_allocation)}
                </td>
                <td className="p-3 text-right">
                  {formatFinanceAmount(operation.actual_spent)}
                </td>
                <td className="p-3">
                  {operation.execution_completed
                    ? strings.completedLabel
                    : operation.execution_started_at
                      ? strings.ongoingLabel
                      : strings.notStartedLabel}
                </td>
                <td className="p-3 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${canRecordOperation(operation) ? strings.record : strings.consult} ${operation.name}`}
                    onClick={(event) =>
                      onSelect(operation.id, event.currentTarget)
                    }
                  >
                    {canRecordOperation(operation)
                      ? strings.record
                      : strings.consult}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function OperationEditor({ activity, operation, pending, mutate }) {
  const draftBasis = useRef(null)
  const formRef = useRef(null)
  const [submissionError, setSubmissionError] = useState('')
  useEffect(() => {
    if (!draftBasis.current) formRef.current?.reset()
  }, [
    operation.actual_spent,
    operation.execution_completed,
    operation.execution_observation,
  ])
  const correction =
    operation.actual_spent !== null ||
    operation.execution_observation ||
    operation.execution_completed
  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">
          {activity.reference} · {activity.name}
        </p>
        <p className="text-sm text-foreground">
          {strings.formatString(strings.operationTypeLabel, {
            type: operation.type_label,
          })}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-border py-3 text-sm">
        <span>{strings.authorizedAmountLabel}</span>
        <strong className="font-semibold text-navy">
          {formatXof(operation.approved_allocation)}
        </strong>
      </div>
      {operation.execution_started_at && (
        <p>
          <Play size={16} aria-hidden="true" /> Démarrée le{' '}
          {formatDateTime(operation.execution_started_at)}
        </p>
      )}
      {operation.variance !== null && (
        <p>Écart avec le montant autorisé : {formatXof(operation.variance)}</p>
      )}
      {operation.allowed_actions.includes('record') && (
        <BusinessForm
          formRef={formRef}
          className="grid gap-5 [&_>_label]:w-full"
          onChangeCapture={() => {
            setSubmissionError('')
            draftBasis.current ??= {
              version: activity.version,
              revision: activity.approved_revision_id,
            }
          }}
          onReset={() => {
            draftBasis.current = null
          }}
          onSubmit={async (event) => {
            event.preventDefault()
            const form = event.currentTarget
            const data = new FormData(form)
            const amount = String(data.get('actual_spent') || '')
            const completed = data.get('execution_completed') === 'on'
            const observation = String(data.get('execution_observation') || '')
            if (
              !operation.execution_started_at &&
              !amount &&
              !completed &&
              !observation.trim()
            ) {
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
            }
            const reason = String(data.get('correction_reason') || '')
            if (reason) body.correction_reason = reason
            const result = await mutate(operation.id, body)
            if (result !== false) {
              draftBasis.current = null
              form.reset()
            }
            return result
          }}
        >
          <label>
            {strings.actualSpent}
            <input
              name="actual_spent"
              inputMode="numeric"
              pattern="(0|[1-9][0-9]*)"
              defaultValue={operation.actual_spent ?? ''}
            />
          </label>
          <label className="grid-cols-[auto_1fr] items-center min-h-11 [&_input]:min-h-auto [&_input]:w-5 [&_input]:h-5">
            <input
              name="execution_completed"
              type="checkbox"
              defaultChecked={operation.execution_completed}
            />
            {strings.physicallyCompleted}
          </label>
          <p className="text-sm text-muted-foreground">
            {strings.zeroSpendingHelp}
          </p>
          <label>
            Observation
            <textarea
              name="execution_observation"
              maxLength="4000"
              defaultValue={operation.execution_observation}
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
              {operation.execution_completed ? (
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
