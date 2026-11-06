import { Slot } from '@radix-ui/react-slot'
import { buttonVariants } from './button-variants'
import { cn } from '@/shared/lib/utils'

export function Button({ className, variant, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp className={cn(buttonVariants({ variant }), className)} {...props} />
  )
}
