import { cn } from '@/shared/lib/utils'
import { businessFieldStyles } from './field-styles'

export function Panel({ as: Component = 'section', className, ...props }) {
  return (
    <Component
      data-ui="planning-card"
      className={cn(
        '[&_h2]:text-navy [&_h2]:font-semibold',
        'bg-white border border-border rounded-panel p-6 grid gap-5',
        businessFieldStyles,
        className,
      )}
      {...props}
    />
  )
}

export function WorkspaceFrame({ as: Component = 'div', className, ...props }) {
  return (
    <Component
      data-ui="workspace-shell"
      className={cn(
        'min-h-screen grid grid-cols-[256px_minmax(0,_1fr)]',
        'max-[761px]:block',
        className,
      )}
      {...props}
    />
  )
}

export function WorkspaceMain({ as: Component = 'main', className, ...props }) {
  return (
    <Component
      data-ui="workspace-main"
      className={cn(
        'mx-auto w-full max-w-360 min-w-0 p-8',
        'max-[641px]:py-6 max-[641px]:px-4',
        className,
      )}
      {...props}
    />
  )
}

export function AdminShell({ as: Component = 'div', className, ...props }) {
  return (
    <Component
      data-ui="access-layout"
      className={cn(
        'grid grid-cols-[256px_minmax(0,_1fr)] min-h-screen',
        '[&_small]:block [&_small]:text-muted-foreground [&_small]:mt-1',
        'max-[761px]:grid-cols-[minmax(0,_1fr)]',
        className,
      )}
      {...props}
    />
  )
}

export function AdminMain({ as: Component = 'main', className, ...props }) {
  return (
    <Component
      data-ui="access-main"
      className={cn(
        'p-8 w-full min-w-0 max-w-360 m-auto',
        businessFieldStyles,
        '[&_input]:max-w-full [&_select]:max-w-full',
        '[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_table]:leading-5',
        '[&_th]:bg-background [&_th]:font-medium [&_th]:text-left [&_th]:p-3 [&_th]:border-b [&_th]:border-b-border [&_th]:wrap-anywhere',
        '[&_td]:p-3 [&_td]:border-b [&_td]:border-b-border [&_td]:wrap-anywhere',
        '[&_tr:last-child_td]:border-b-0',
        '[&_button:disabled]:opacity-50 [&_button:disabled]:cursor-not-allowed',
        'max-[761px]:py-6 max-[761px]:px-4',
        'max-[761px]:[&_table]:min-w-135',
        className,
      )}
      {...props}
    />
  )
}
