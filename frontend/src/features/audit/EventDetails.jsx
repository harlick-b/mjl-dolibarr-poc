import { strings } from '@/locales/fr/AuditHistoryView'
import { formatAuditValue } from './auditPresentation'

export function EventDetails({ event, inline = false, changesOnly = false }) {
  if (
    !event.reason &&
    !event.changes?.length &&
    (changesOnly || !event.facts?.length)
  )
    return null
  const content = (
    <div className="grid gap-2 py-1 text-sm">
      {event.reason && (
        <p>
          <strong>{strings.reason} :</strong> {event.reason}
        </p>
      )}
      {!changesOnly &&
        event.facts?.map((fact) => (
          <p key={fact.field}>
            {fact.field} : {formatAuditValue(fact.after, fact.field)}
          </p>
        ))}
      {event.changes?.map((change) => (
        <p key={change.field}>
          {change.field} : {formatAuditValue(change.before, change.field)} →{' '}
          {formatAuditValue(change.after, change.field)}
        </p>
      ))}
    </div>
  )
  if (inline) return content
  return (
    <details className="mt-2 whitespace-normal break-words">
      <summary className="cursor-pointer text-primary font-medium">
        {strings.details}
      </summary>
      {content}
    </details>
  )
}
