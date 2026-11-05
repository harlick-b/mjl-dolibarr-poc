export function FallbackState({
  title,
  children,
  action,
  local = false,
  role = 'alert',
}) {
  return (
    <section
      className={`fallback-state${local ? ' fallback-state-local' : ''}`}
      role={role}
    >
      {local ? <h2>{title}</h2> : <h1>{title}</h1>}
      <div className="fallback-state-message">{children}</div>
      {action && <div className="fallback-state-action">{action}</div>}
    </section>
  )
}

export function EmptyState({ children, action }) {
  return (
    <section className="empty-state" aria-live="polite">
      <h2>{strings.noResults}</h2>
      <div>{children}</div>
      {action}
    </section>
  )
}
import { strings } from '@/locales/fr/common'
