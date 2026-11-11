import { strings } from '@/locales/fr/AuditHistoryView'
import { EventDetails } from './EventDetails'

export function ActivityTimeline({ events, navigate }) {
  return (
    <ol className="ml-6 grid gap-5 border-l border-border px-6 py-5">
      {events.map((event) => (
        <li
          key={event.id}
          className={`relative grid gap-1 break-words before:absolute before:-left-[1.78rem] before:top-1.5 before:size-2 before:rounded-full before:border ${event.milestone ? 'before:border-primary before:bg-primary' : 'before:border-strong-border before:bg-white'}`}
        >
          <strong>{event.label}</strong>
          <span className="text-sm text-muted-foreground">
            <time dateTime={event.occurred_at}>
              {new Intl.DateTimeFormat('fr-FR', {
                timeZone: 'Africa/Porto-Novo',
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(event.occurred_at))}
            </time>
            {' · '}
            {event.actor?.full_name || strings.system}
            {event.actor?.role ? ` · ${event.actor.role}` : ''}
          </span>
          <EventDetails event={event} inline />
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
              {strings.submittedInformation}
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
