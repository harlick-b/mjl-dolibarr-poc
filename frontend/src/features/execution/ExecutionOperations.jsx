import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, CircleDollarSign, Play } from 'lucide-react'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Panel } from '@/shared/ui/layout'
import { Button } from '@/shared/ui/button'
import { formatXof } from '@/shared/lib/format'
import { strings } from '@/locales/fr/ExecutionView'

export function ExecutionOperations({ detail, onSelect }) {
  return (
    <section className="overflow-hidden rounded-panel border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-selected px-5 py-4">
        <div>
          <h2 className="font-semibold text-navy">
            {strings.physicalProgress}
          </h2>
          <p className="text-sm text-muted-foreground">
            {detail.completed_operations} / {detail.operation_count}{' '}
            {strings.operationsCompleted}
          </p>
        </div>
        <span className="rounded-card bg-white px-2 py-1 text-xs text-primary">
          {detail.works_completed ? strings.completedLabel : strings.toProcess}
        </span>
      </div>
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
                  {operation.actual_spent === null
                    ? strings.notRecorded
                    : formatXof(operation.actual_spent)}
                </td>
                <td className="p-3">
                  {operation.execution_completed
                    ? strings.completedLabel
                    : strings.ongoingLabel}
                </td>
                <td className="p-3 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${strings.consult} ${operation.name}`}
                    onClick={(event) =>
                      onSelect(operation.id, event.currentTarget)
                    }
                  >
                    {strings.consult}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function OperationEditor({ activity, operation, pending, mutate }) {
  const draftBasis = useRef(null)
  const formRef = useRef(null)
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
    <Panel as="div" className="rounded-none border-0 p-6 shadow-none">
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">
            {operation.type_label}
          </p>
          <h2>{operation.name}</h2>
        </div>
        <span>{formatXof(operation.approved_allocation)} autorisés</span>
      </div>
      {operation.execution_started_at ? (
        <p>
          <Play size={16} aria-hidden="true" /> Démarrée le{' '}
          {new Date(operation.execution_started_at).toLocaleString('fr-FR')}
        </p>
      ) : (
        operation.allowed_actions.includes('start') && (
          <Button
            disabled={pending || !navigator.onLine}
            onClick={() =>
              mutate(operation.id, {
                action: 'start',
                expected_version: activity.version,
                expected_approved_revision_id: activity.approved_revision_id,
              })
            }
          >
            <Play size={16} /> Démarrer
          </Button>
        )
      )}
      {operation.variance !== null && (
        <p>Écart avec le montant autorisé : {formatXof(operation.variance)}</p>
      )}
      {operation.allowed_actions.includes('record') && (
        <BusinessForm
          formRef={formRef}
          className="[&_>_label]:w-full"
          onChangeCapture={() => {
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
            const body = {
              action: 'record',
              expected_version: draftBasis.current?.version ?? activity.version,
              expected_approved_revision_id:
                draftBasis.current?.revision ?? activity.approved_revision_id,
              actual_spent: amount || null,
              execution_completed: data.get('execution_completed') === 'on',
              execution_observation: String(
                data.get('execution_observation') || '',
              ),
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
          <div className="flex gap-3 items-end flex-wrap">
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
              Opération terminée
            </label>
          </div>
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
              Motif de la correction
              <textarea name="correction_reason" maxLength="4000" />
            </label>
          )}
          <Button type="submit" disabled={pending || !navigator.onLine}>
            {operation.execution_completed ? (
              <CheckCircle2 size={16} />
            ) : (
              <CircleDollarSign size={16} />
            )}
            Enregistrer
          </Button>
          <Button type="reset" variant="outline" disabled={pending}>
            {strings.cancelEntry}
          </Button>
        </BusinessForm>
      )}
      <section className="border-t border-border pt-5">
        <h3 className="font-semibold text-navy">{strings.evidenceTitle}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {strings.operationEvidenceExplanation}
        </p>
        <Button asChild variant="outline" className="mt-3">
          <Link
            to="/activities/$activityId"
            params={{ activityId: activity.id }}
            search={{ tab: 'files' }}
          >
            {strings.operationEvidenceLink}
          </Link>
        </Button>
      </section>
    </Panel>
  )
}
