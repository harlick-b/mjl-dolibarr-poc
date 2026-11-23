import { formatDateTime } from '@/shared/lib/format'

const correctionRoleLabels = {
  AGENT_VERIFICATEUR: 'Superviseur',
  VALIDATEUR_DEFINITIF: 'Validateur définitif',
}

function correctionAttribution(correction) {
  const role = correctionRoleLabels[correction?.actor_role]
  const actor = correction?.actor_name
    ? `${correction.actor_name}${role ? ` (${role})` : ''}`
    : role
      ? `le ${role}`
      : ''
  const date = correction?.decided_at
    ? formatDateTime(correction.decided_at)
    : ''
  if (actor && date) return `Retour demandé par ${actor} le ${date}.`
  if (actor) return `Retour demandé par ${actor}.`
  if (date) return `Retour demandé le ${date}.`
  return ''
}

export function CorrectionNotice({ title, correction, className = '' }) {
  if (!correction?.reason) return null
  const attribution = correctionAttribution(correction)
  return (
    <section
      role="status"
      aria-label={title}
      className={`rounded-card border border-correction-border bg-correction-surface px-5 py-4 ${className}`}
    >
      <h2 className="text-sm font-semibold text-warning">{title}</h2>
      {attribution && (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {attribution}
        </p>
      )}
      <h3 className="mt-4 text-xs font-semibold text-navy">Motif du retour</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
        {correction.reason}
      </p>
    </section>
  )
}
