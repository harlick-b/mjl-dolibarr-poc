import { cn } from '@/shared/lib/utils'
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'
import { strings } from '@/locales/fr/Navigation'

import { outsideDialog } from './dialog-events'
import { businessFieldStyles } from './field-styles'

export function Modal({
  open,
  onClose,
  label,
  subtitle,
  children,
  opener,
  className,
  closeDisabled = false,
  variant = 'dialog',
}) {
  const ref = useRef(null)
  const outside = useRef(false)
  const automaticOpener = useRef(null)
  const focusOpener = () => {
    const target = opener?.current ?? automaticOpener.current
    if (target?.isConnected) target.focus()
  }
  const requestClose = () => {
    if (closeDisabled) return
    onClose()
    // The owner may unmount the dialog immediately. Restore focus after React
    // applies that update instead of relying only on the native close event.
    setTimeout(focusOpener, 0)
  }
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    let focusTarget = opener?.current ?? automaticOpener.current
    if (open && !dialog.open) {
      automaticOpener.current = document.activeElement
      focusTarget ??= automaticOpener.current
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
    return () => {
      if (open && focusTarget?.isConnected) focusTarget.focus()
    }
  }, [open, opener])
  return (
    <dialog
      ref={ref}
      hidden={!open}
      aria-label={label}
      className={cn(
        variant === 'drawer'
          ? "m-0 ml-auto h-dvh max-h-dvh w-[min(560px,100%)] overflow-hidden rounded-none border border-y-0 border-r-0 border-border bg-white p-0 text-foreground backdrop:bg-overlay backdrop:backdrop-blur-sm open:flex open:flex-col sm:rounded-l-panel [&>header]:shrink-0 [&>form]:min-h-0 [&>form]:flex-1 [&>form]:flex-col [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col [&>div]:overflow-y-auto [&>div>[data-ui~='planning-card']]:flex-1 [&_[data-ui~='modal-actions']]:sticky [&_[data-ui~='modal-actions']]:bottom-0 [&_[data-ui~='modal-actions']]:z-20 [&_[data-ui~='modal-actions']]:bg-white"
          : 'm-auto w-[min(560px,calc(100%-32px))] max-h-[calc(100dvh-32px)] overflow-auto rounded-panel border border-border bg-white p-0 text-foreground backdrop:bg-overlay backdrop:backdrop-blur-sm',
        '[&_form]:grid [&_form]:min-w-0 [&_form]:gap-6 [&>form]:p-6',
        businessFieldStyles,
        variant === 'drawer'
          ? "[&_[data-ui~='modal-actions']]:mt-auto"
          : "[&_[data-ui~='modal-actions']]:mt-2",
        "[&_[data-ui~='modal-actions']]:-mx-6 [&_[data-ui~='modal-actions']]:-mb-6 [&_[data-ui~='modal-actions']]:border-t [&_[data-ui~='modal-actions']]:border-border [&_[data-ui~='modal-actions']]:px-6 [&_[data-ui~='modal-actions']]:py-4 [&_[data-ui~='modal-actions']]:flex [&_[data-ui~='modal-actions']]:flex-wrap [&_[data-ui~='modal-actions']]:justify-end [&_[data-ui~='modal-actions']]:gap-3",
        className,
      )}
      onPointerDown={(event) => {
        outside.current = outsideDialog(event)
      }}
      onClick={(event) => {
        if (outside.current && outsideDialog(event)) requestClose()
      }}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClose={() => {
        focusOpener()
      }}
    >
      <header className="flex min-h-18 items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{label}</h2>
          {subtitle && (
            <p className="mt-2 truncate text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="size-8 min-h-8 shrink-0 p-0"
          aria-label={strings.close}
          disabled={closeDisabled}
          onClick={requestClose}
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </header>
      {children}
    </dialog>
  )
}
