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
      className={className}
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
