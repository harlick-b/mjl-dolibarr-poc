import { strings } from '@/locales/fr/AuditHistoryView'
import { EventDetails } from './EventDetails'
import { formatDateTime } from '@/shared/lib/format'

export function ActivityTimeline({ events }) {
  return (
    <ol className="ml-6 grid gap-5 border-l border-border px-6 py-5 text-[0.8125rem]">
      {events.map((event) => (
        <li
          key={event.id}
          className={`relative grid gap-1 break-words before:absolute before:-left-[1.78rem] before:top-1.5 before:size-2 before:rounded-full before:border ${event.milestone ? 'before:border-primary before:bg-primary' : 'before:border-strong-border before:bg-white'}`}
        >
          <strong>{event.label}</strong>
          <span className="text-xs leading-5 text-muted-foreground">
            <time dateTime={event.occurred_at}>
              {formatDateTime(event.occurred_at)}
            </time>
            {' · '}
            {event.actor?.full_name || strings.system}
            {event.actor?.role ? ` · ${event.actor.role}` : ''}
          </span>
          <EventDetails event={event} inline changesOnly />
        </li>
      ))}
    </ol>
  )
}
