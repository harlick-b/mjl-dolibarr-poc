// shadcn/ui Button pattern, reduced to the foundation's actual variant.
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 active:opacity-80 disabled:pointer-events-none disabled:opacity-50',
)

export function Button({ className, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants(), className)} {...props} />
}
