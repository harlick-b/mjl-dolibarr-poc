import { Slot } from '@radix-ui/react-slot'
import { buttonVariants } from './button-variants'
import { cn } from '@/shared/lib/utils'
import { useContext, useId } from 'react'
import { LoaderCircle } from 'lucide-react'
import { FormSubmitContext } from './form-submit-context'

export function Button({
  ref,
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  ...props
}) {
  const submitting = useContext(FormSubmitContext)
  const submitControlId = useId()
  const busy =
    loading ||
    (submitting &&
      submitting === submitControlId &&
      !asChild &&
      (!props.type || props.type === 'submit'))
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
      data-business-submit-id={asChild ? undefined : submitControlId}
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
