import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from './button'
import { strings as common } from '@/locales/fr/common'

export function AgentSearchPanel({
  title,
  searchLabel,
  value,
  onChange,
  onClose,
  children,
  footer,
  className,
  listProps = {},
}) {
  const { onKeyDown, ...resolvedListProps } = listProps
  const moveOptionFocus = (event) => {
    onKeyDown?.(event)
    if (
      event.defaultPrevented ||
      !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
    )
      return
    const options = [...event.currentTarget.querySelectorAll('[role=option]')]
    if (!options.length) return
    event.preventDefault()
    const index = options.indexOf(document.activeElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
            options.length
    options[next]?.focus()
  }
  return (
    <div
      className={cn(
        'grid w-72 gap-3 rounded-panel border border-border bg-white p-3 shadow-lg',
        className,
      )}
    >
      {title && (
        <div className="flex min-h-8 items-center justify-between gap-3 px-1">
          <strong className="text-sm font-semibold">{title}</strong>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              className="size-8 min-h-8 p-0"
              aria-label={`${common.dismiss} ${title}`}
              onClick={onClose}
            >
              <X size={17} aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={searchLabel}
        aria-label={searchLabel}
        maxLength={200}
        autoFocus
        className="h-10 w-full rounded-control border border-primary bg-white px-3 text-sm outline outline-2 outline-offset-2 outline-primary"
      />
      <div
        className="grid max-h-52 gap-1 overflow-y-auto"
        role="listbox"
        onKeyDown={moveOptionFocus}
        {...resolvedListProps}
      >
        {children}
      </div>
      {footer}
    </div>
  )
}
