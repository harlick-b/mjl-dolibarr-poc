import { strings as common } from '@/locales/fr/common'
import { cn } from '@/shared/lib/utils'
import { Button } from './button'

export function Pagination({
  label,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  busy = false,
  size = 'default',
  previousLabel = common.previous,
  nextLabel = common.next,
  className,
  visible,
}) {
  if (visible === false || (visible === undefined && !canPrevious && !canNext))
    return null
  return (
    <nav
      aria-label={label}
      className={cn('flex flex-wrap items-end gap-2', className)}
    >
      <Button
        type="button"
        size={size}
        variant="outline"
        disabled={busy || !canPrevious}
        onClick={onPrevious}
      >
        {previousLabel}
      </Button>
      <Button
        type="button"
        size={size}
        variant="outline"
        disabled={busy || !canNext}
        onClick={onNext}
      >
        {nextLabel}
      </Button>
    </nav>
  )
}
