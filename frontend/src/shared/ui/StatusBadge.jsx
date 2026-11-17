import { cn } from '@/shared/lib/utils'

export function StatusBadge({ children, className, ...props }) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex min-h-5 max-w-full shrink-0 items-center rounded-card px-2 py-1 text-xs leading-4 whitespace-normal break-words text-center',
        className,
      )}
    >
      {children}
    </span>
  )
}
