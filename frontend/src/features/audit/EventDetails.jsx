import { strings } from '@/locales/fr/AuditHistoryView'
import { formatDate, formatDateTime, formatXof } from '@/shared/lib/format'

const dateFields = new Set([
  'Début prévu',
  'Fin prévue',
  'Date effective',
  'Date du virement',
  'Date du reversement',
])

function readable(value, field) {
  if (!value) return '—'
  if (field.includes('(F CFA)') && /^-?[0-9]+$/.test(value))
    return formatXof(value)
  if (dateFields.has(field) && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return formatDate(value)
  if (field === 'Début de réalisation') return formatDateTime(value)
  return value
}

export function EventDetails({ event }) {
  if (!event.reason && !event.changes?.length && !event.facts?.length)
    return null
  return (
    <details className="mt-2 whitespace-normal break-words">
      <summary className="cursor-pointer text-primary font-medium">
        {strings.details}
      </summary>
      <div className="grid gap-2 py-2">
        {event.reason && (
          <p>
            <strong>{strings.reason} :</strong> {event.reason}
          </p>
        )}
        {event.facts?.map((fact) => (
          <p key={fact.field}>
            {fact.field} : {readable(fact.after, fact.field)}
          </p>
        ))}
        {event.changes?.map((change) => (
          <p key={change.field}>
            {change.field} : {readable(change.before, change.field)} →{' '}
            {readable(change.after, change.field)}
          </p>
        ))}
      </div>
    </details>
  )
}
