import { LoaderCircle } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { strings } from '@/locales/fr/PageLoading'
import { strings as common } from '@/locales/fr/common'

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

export function PageLoading({ title }) {
  return (
    <section
      className="page-loading"
      role="status"
      aria-label={strings.formatString(common.pageLoading, { page: title })}
      aria-busy="true"
    >
      <Helmet>
        <title>{title} — MJL</title>
      </Helmet>
      <LoaderCircle
        className="page-loading-spinner"
        size={22}
        aria-hidden="true"
      />
      <p>{common.dataLoading}</p>
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
