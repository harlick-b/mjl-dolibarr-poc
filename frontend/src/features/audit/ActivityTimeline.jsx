import { strings } from '@/locales/fr/AuditHistoryView'
import { EventDetails } from './EventDetails'

export function ActivityTimeline({ events, navigate }) {
  return (
    <ol className="border-l border-border grid gap-4 ml-5 p-5">
      {events.map((event) => (
        <li key={event.id} className="grid gap-1 break-words">
          <span className="text-xs text-muted-foreground">
            {event.milestone ? strings.milestone : strings.change}
          </span>
          <strong className={event.milestone ? 'text-primary' : 'font-medium'}>
            {event.label}
          </strong>
          <span className="text-sm text-muted-foreground">
            <time dateTime={event.occurred_at}>
              {new Intl.DateTimeFormat('fr-FR', {
                timeZone: 'Africa/Porto-Novo',
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(event.occurred_at))}
            </time>
            {' · '}
            {event.actor?.full_name || event.actor?.email || strings.system}
          </span>
          <EventDetails event={event} />
          {event.revision_id && (
            <button
              type="button"
              className="text-primary text-left underline"
              onClick={() =>
                navigate({
                  search: (current) => ({
                    ...current,
                    revision: event.revision_id,
                    amendment: undefined,
                  }),
                })
              }
            >
              {strings.revision}
            </button>
          )}
          {event.amendment_id && (
            <button
              type="button"
              className="text-primary text-left underline"
              onClick={() =>
                navigate({
                  search: (current) => ({
                    ...current,
                    amendment: event.amendment_id,
                    revision: undefined,
                  }),
                })
              }
            >
              {strings.amendment}
            </button>
          )}
        </li>
      ))}
    </ol>
  )
}
