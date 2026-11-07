import { strings } from '@/locales/fr/AuditHistoryView'

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
            {fact.field} : {fact.after ?? '—'}
          </p>
        ))}
        {event.changes?.map((change) => (
          <p key={change.field}>
            {change.field} : {change.before ?? '—'} → {change.after ?? '—'}
          </p>
        ))}
      </div>
    </details>
  )
}
