import { cn } from '@/shared/lib/utils'

export function StatusBadge({ children, className, ...props }) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex min-h-5 w-fit min-w-0 max-w-full items-center self-start rounded-card px-2 py-1 text-center text-xs leading-4 whitespace-normal break-words',
        className,
      )}
    >
      {children}
    </span>
  )
}
