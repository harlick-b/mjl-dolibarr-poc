import { businessActionClassName } from '@/shared/ui/button-variants'
import { FallbackState } from './FallbackState'
import { strings } from '@/locales/fr/common'

export function RetryableError({ children, onRetry, page = false }) {
  return (
    <FallbackState
      local={!page}
      title={page ? strings.serviceUnavailable : strings.dataUnavailable}
      action={
        <button
          className={businessActionClassName}
          onClick={onRetry}
          type="button"
        >
          {strings.retry}
        </button>
      }
    >
      <p>{children}</p>
    </FallbackState>
  )
}
