import { LoaderCircle } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { strings } from '@/shared/i18n'

export function LoadingPlaceholder({ label, variant = 'table' }) {
  return (
    <div
      className={`loading-placeholder loading-placeholder-${variant}`}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <div className="loading-placeholder-content" aria-hidden="true">
        {Array.from({ length: variant === 'form' ? 4 : 5 }, (_, index) => (
          <span className="loading-placeholder-bar" key={index} />
        ))}
      </div>
    </div>
  )
}

export function PageLoading({ title, variant = 'table' }) {
  return (
    <section className="planning-stack">
      <Helmet>
        <title>{title} — MJL</title>
      </Helmet>
      <header className="planning-heading">
        <h1>{title}</h1>
      </header>
      <LoadingPlaceholder
        label={strings.formatString(strings.pageLoading, { page: title })}
        variant={variant}
      />
    </section>
  )
}

export function RefreshIndicator({ active }) {
  if (!active) return null
  return (
    <span
      className="page-refresh"
      role="status"
      aria-label={strings.refreshing}
      aria-busy="true"
    >
      <LoaderCircle
        className="auth-button-spinner"
        size={20}
        aria-hidden="true"
      />
    </span>
  )
}
