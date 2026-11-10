import { cn } from '@/shared/lib/utils'
import { LoaderCircle } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { strings } from '@/locales/fr/PageLoading'
import { strings as common } from '@/locales/fr/common'

export function LoadingPlaceholder({ label, variant = 'table' }) {
  return (
    <div
      data-ui="loading-placeholder"
      className={cn(
        'rounded-panel border border-border bg-white p-6',
        variant === 'form' && 'max-w-180',
      )}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <div
        className={cn(
          'grid gap-4',
          variant === 'form' && 'gap-8',
          variant === 'detail' && 'grid-cols-2 max-[641px]:grid-cols-1',
        )}
        aria-hidden="true"
      >
        {Array.from({ length: variant === 'form' ? 4 : 5 }, (_, index) => (
          <span
            className={cn(
              'block h-10 rounded-control bg-disabled',
              variant === 'detail' && index === 0 && 'col-span-full h-24',
              variant === 'preview' && 'h-16',
            )}
            key={index}
          />
        ))}
      </div>
    </div>
  )
}

export function PageLoading({ title, className, label = common.dataLoading }) {
  return (
    <section
      className={cn(
        'min-h-[calc(100dvh-96px)] grid place-content-center justify-items-center gap-3 text-muted-foreground',
        className,
      )}
      role="status"
      aria-label={strings.formatString(common.pageLoading, { page: title })}
      aria-busy="true"
    >
      <Helmet>
        <title>{`${title} - MJL`}</title>
      </Helmet>
      <LoaderCircle
        className="text-primary animate-spin [animation-duration:0.8s]"
        size={22}
        aria-hidden="true"
      />
      <p>{label}</p>
    </section>
  )
}

export function RefreshIndicator({ active }) {
  if (!active) return null
  return (
    <span
      className="inline-flex text-primary"
      role="status"
      aria-label={strings.refreshing}
      aria-busy="true"
    >
      <LoaderCircle
        className="animate-spin mr-2"
        size={20}
        aria-hidden="true"
      />
    </span>
  )
}
