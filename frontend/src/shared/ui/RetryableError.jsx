import { Button } from './button'
import { FallbackState } from './FallbackState'
import { strings } from '@/locales/fr/common'

export function RetryableError({ children, onRetry, page = false }) {
  return (
    <FallbackState
      local={!page}
      title={page ? strings.serviceUnavailable : strings.dataUnavailable}
      action={
        <Button onClick={onRetry} type="button">
          {strings.retry}
        </Button>
      }
    >
      <p>{children}</p>
    </FallbackState>
  )
}
