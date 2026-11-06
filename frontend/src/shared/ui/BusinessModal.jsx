import { cn } from '@/shared/lib/utils'
import { useEffect, useRef } from 'react'

export function Modal({ open, onClose, label, children, opener, className }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={cn(
        'm-auto w-[min(560px,calc(100%-32px))] max-h-[calc(100dvh-32px)] overflow-auto rounded-panel border border-border bg-white p-0 text-foreground backdrop:bg-overlay',
        '[&>form]:grid [&>form]:min-w-0 [&>form]:gap-6 [&>form]:p-6',
        "[&_[data-ui~='modal-actions']]:flex [&_[data-ui~='modal-actions']]:flex-wrap [&_[data-ui~='modal-actions']]:justify-end [&_[data-ui~='modal-actions']]:gap-2",
        className,
      )}
      onCancel={onClose}
      onClose={() => {
        onClose()
        opener.current?.focus()
      }}
    >
      {children}
    </dialog>
  )
}
