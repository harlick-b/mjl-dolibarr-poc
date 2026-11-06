import { cn } from '@/shared/lib/utils'
export function FallbackState({
  title,
  children,
  action,
  local = false,
  role = 'alert',
}) {
  return (
    <section
      className={cn(
        'grid place-content-center justify-items-center gap-4 px-6 py-10 text-center',
        local
          ? 'min-h-65 rounded-panel border border-border bg-white'
          : 'min-h-[calc(100dvh-96px)]',
      )}
      role={role}
    >
      {local ? (
        <h2 className="text-lg font-semibold leading-7 text-navy">{title}</h2>
      ) : (
        <h1 className="text-[1.75rem] font-semibold leading-9 text-navy">
          {title}
        </h1>
      )}
      <div className="max-w-140 text-muted-foreground leading-6">
        {children}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </section>
  )
}

export function EmptyState({ children, action }) {
  return (
    <section
      className="min-h-54 grid content-center justify-items-center gap-3 py-10 px-5 text-muted-foreground text-center [&_h2]:text-navy [&_h2]:text-base [&_h2]:font-semibold"
      aria-live="polite"
    >
      <h2>{strings.noResults}</h2>
      <div>{children}</div>
      {action}
    </section>
  )
}
import { strings } from '@/locales/fr/common'
