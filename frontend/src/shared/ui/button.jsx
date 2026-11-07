import { Slot } from '@radix-ui/react-slot'
import { buttonVariants } from './button-variants'
import { cn } from '@/shared/lib/utils'
import { useContext } from 'react'
import { LoaderCircle } from 'lucide-react'
import { FormSubmitContext } from './form-submit-context'

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  ...props
}) {
  const submitting = useContext(FormSubmitContext)
  const busy =
    loading ||
    (submitting && !asChild && (!props.type || props.type === 'submit'))
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || props['aria-busy']}
    >
      {asChild ? (
        children
      ) : (
        <>
          {busy && (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          )}
          {children}
        </>
      )}
    </Comp>
  )
}
