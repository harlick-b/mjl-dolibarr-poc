import { useRef, useState } from 'react'
import { formatDateTime, formatXof } from '@/shared/lib/format'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Button } from '@/shared/ui/button'
import { FileSelection } from '@/shared/ui/FileSelection'
import { ExactNumberInput } from '@/shared/ui/ExactNumberInput'

export function FinancialRequestSummary({
  requested,
  authorized,
  budget,
  spending,
  requestedLabel,
  authorizedLabel,
  unavailableLabel,
}) {
  const values = [
    [
      requestedLabel,
      requested === null ? unavailableLabel : formatXof(requested),
    ],
    [
      authorizedLabel,
      authorized === null ? unavailableLabel : formatXof(authorized),
    ],
    ['Budget prévu', formatXof(budget)],
    ['Dépenses enregistrées', formatXof(spending)],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-border pb-5 text-sm max-[520px]:grid-cols-1">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-base font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function FinancialRequestCreationContext({ budget, authorized }) {
  return (
    <dl className="grid grid-cols-2 gap-8 text-sm max-[520px]:grid-cols-1">
      <div>
        <dt className="text-xs text-muted-foreground">Budget prévu</dt>
        <dd className="mt-1 text-base font-medium">{formatXof(budget)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">
          Total actuellement autorisé
        </dt>
        <dd className="mt-1 text-base font-medium">
          {authorized === null ? 'Non renseigné' : formatXof(authorized)}
        </dd>
      </div>
    </dl>
  )
}

export function FinancialDecisionHistory({ decisions, stateLabels }) {
  return (
    <section className="grid gap-3 border-b border-border pb-5">
      <h3 className="font-semibold">Décisions</h3>
      {decisions.length ? (
        <ol className="grid gap-3">
          {decisions.map((decision) => (
            <li key={decision.id} className="text-sm">
              <strong>
                {decision.stage === 'supervisor' ? 'Superviseur' : 'Validateur'}{' '}
                · {stateLabels[decision.outcome] || decision.outcome}
              </strong>
              <span className="mt-1 block text-muted-foreground">
                {decision.actor_name} · {formatDateTime(decision.decided_at)}
              </span>
              {decision.reason && <p className="mt-1">{decision.reason}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune décision.</p>
      )}
    </section>
  )
}

export function FinancialRequestApplicantDetails({ request }) {
  return (
    <section className="grid gap-3 border-b border-border pb-5 text-sm">
      {request.observation && (
        <div>
          <h3 className="font-semibold">Observation du demandeur</h3>
          <p className="mt-2 whitespace-pre-wrap">{request.observation}</p>
        </div>
      )}
      <p className="text-muted-foreground">
        {request.submitter_name || 'Utilisateur indisponible'}
      </p>
    </section>
  )
}

export function FinancialRequestCreateForm({
  maximumAmount,
  pending,
  onCancel,
  onSubmit,
}) {
  const [file, setFile] = useState(null)
  const [amount, setAmount] = useState(String(maximumAmount || ''))
  const [amountError, setAmountError] = useState('')
  return (
    <BusinessForm
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const submittedAmount = String(data.get('amount') || '')
        if (!/^[1-9][0-9]*$/.test(submittedAmount)) {
          setAmountError('Saisissez un montant positif en francs CFA.')
          return false
        }
        if (BigInt(submittedAmount) > BigInt(maximumAmount)) {
          setAmountError(
            `Le montant ne peut pas dépasser ${formatXof(maximumAmount)}.`,
          )
          return false
        }
        setAmountError('')
        return onSubmit(
          {
            amount: submittedAmount,
            observation: String(data.get('observation') || ''),
          },
          file,
        )
      }}
    >
      <label>
        Montant total demandé (F CFA) *
        <ExactNumberInput
          name="amount"
          aria-label="Montant total demandé (F CFA)"
          value={amount}
          onChange={(value) => {
            setAmount(value)
            setAmountError('')
          }}
          required
          aria-invalid={Boolean(amountError)}
          aria-describedby={
            amountError ? 'financial-request-amount-error' : undefined
          }
          onInvalid={() =>
            setAmountError('Saisissez un montant positif en francs CFA.')
          }
        />
        {amountError && (
          <span
            id="financial-request-amount-error"
            className="text-xs font-normal text-danger"
            role="alert"
          >
            {amountError}
          </span>
        )}
      </label>
      <label>
        Observation
        <textarea name="observation" maxLength="4000" />
      </label>
      <FileSelection
        label="Pièce justificative"
        chooseLabel="Choisir un fichier"
        emptyLabel="Aucun fichier sélectionné"
        file={file}
        accept="application/pdf,image/jpeg,image/png"
        disabled={pending}
        onChange={(event) => setFile(event.target.files?.[0] || null)}
      />
      <div data-ui="modal-actions">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending || !navigator.onLine}>
          Faire la demande
        </Button>
      </div>
    </BusinessForm>
  )
}

export function FinancialCancellationForm({
  request,
  version,
  path,
  pending,
  mutate,
  onSuccess,
  className,
}) {
  const draftVersion = useRef(null)
  if (!request.allowed_actions.includes('cancel')) return null
  return (
    <BusinessForm
      className={className}
      onChangeCapture={() => {
        draftVersion.current ??= version
      }}
      onSubmit={async (event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const reason = String(data.get('reason') || '')
        const result = await mutate(`${path}/${request.id}/cancellation`, {
          expected_version: draftVersion.current ?? version,
          reason,
        })
        if (result !== false) onSuccess?.()
        return result
      }}
    >
      <label>
        Motif *
        <textarea name="reason" required maxLength="4000" />
      </label>
      <Button
        type="submit"
        variant="outline"
        disabled={pending || !navigator.onLine}
      >
        Annuler la demande
      </Button>
    </BusinessForm>
  )
}
