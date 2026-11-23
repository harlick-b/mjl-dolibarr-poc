import { formatDateTime } from '@/shared/lib/format'
import { strings } from '@/locales/fr/AuditHistoryView'
import {
  activityEventPresentation,
  formatActivityAuditValue,
} from './auditPresentation'

function isCorrectionAction(action) {
  return (
    action.includes('.returned') ||
    action.includes('.return_') ||
    action.includes('_return_')
  )
}

function attribution(action) {
  if (action === 'activity.closed') return strings.closedBy
  if (action === 'activity.create') return strings.createdBy
  if (isCorrectionAction(action)) return strings.returnedBy
  if (action.endsWith('.submit') || action.endsWith('_submit'))
    return strings.submittedBy
  if (
    action.endsWith('.prevalidated') ||
    action.endsWith('.prevalidate') ||
    action.endsWith('_prevalidate')
  )
    return strings.prevalidatedBy
  if (
    action === 'activity.approve' ||
    action.endsWith('_approve') ||
    action === 'zero_spending.approved'
  )
    return strings.validatedBy
  if (action.endsWith('.approved')) return strings.authorizedBy
  if (action.endsWith('.declared')) return strings.declaredBy
  if (action.endsWith('.cancel') || action.endsWith('_cancel'))
    return strings.cancelledBy
  if (action.endsWith('.corrected')) return strings.correctedBy
  if (action.includes('.execution_')) return strings.recordedBy
  return strings.responsible
}

function ActivityEventDetails({ event }) {
  const { direct, comparisons } = activityEventPresentation(event)
  const correction = isCorrectionAction(event.action)

  if (!event.reason && !direct.length && !comparisons.length) return null

  return (
    <div className="mt-3 grid gap-4 text-[0.8125rem] leading-5">
      {event.reason && (
        <div className="grid gap-1">
          <strong>{correction ? strings.returnReason : strings.reason}</strong>
          <p className="whitespace-pre-wrap">{event.reason}</p>
        </div>
      )}
      {direct.length > 0 && (
        <dl className="grid gap-2">
          {direct.map((entry) => (
            <div
              key={`${entry.field}-${entry.after}`}
              className="flex flex-wrap gap-x-1"
            >
              <dt>{entry.label} :</dt>
              <dd className="font-medium">
                {formatActivityAuditValue(entry.after, entry.field)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {comparisons.length > 0 && (
        <table className="w-full table-fixed text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="w-[42%] pb-2 pr-3 font-medium">
                {strings.information}
              </th>
              <th className="w-[29%] pb-2 pr-3 font-medium">
                {strings.before}
              </th>
              <th className="w-[29%] pb-2 font-medium">{strings.after}</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((change) => (
              <tr key={change.field} className="align-top">
                <th className="py-1 pr-3 font-medium">{change.label}</th>
                <td className="py-1 pr-3">
                  {formatActivityAuditValue(change.before, change.field)}
                </td>
                <td className="py-1">
                  {change.removed
                    ? strings.removed
                    : formatActivityAuditValue(change.after, change.field)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function ActivityTimeline({ events }) {
  return (
    <ol className="divide-y divide-border text-[0.8125rem]">
      {events.map((event) => (
        <li key={event.id} className="break-words px-5 py-5">
          <div className="grid gap-1">
            <strong className="text-sm leading-5">{event.label}</strong>
            <time
              dateTime={event.occurred_at}
              className="text-xs leading-5 text-muted-foreground"
            >
              {formatDateTime(event.occurred_at)}
            </time>
            {event.actor?.full_name && (
              <p className="text-xs leading-5 text-muted-foreground">
                {attribution(event.action)} {event.actor.full_name}
              </p>
            )}
          </div>
          <ActivityEventDetails event={event} />
        </li>
      ))}
    </ol>
  )
}
