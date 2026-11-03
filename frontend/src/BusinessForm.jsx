import { useState } from 'react'

// A form owns its unsaved input until its own command succeeds or it is closed.
export function BusinessForm({
  onSubmit,
  onChangeCapture,
  onReset,
  formRef,
  dirty,
  children,
  ...props
}) {
  const [edited, setEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  return (
    <form
      ref={formRef}
      {...props}
      data-update-blocked={Boolean(saving || (dirty ?? edited))}
      onChangeCapture={(event) => {
        setEdited(true)
        onChangeCapture?.(event)
      }}
      onClickCapture={(event) => {
        if (event.target.closest('[data-edits-form]')) setEdited(true)
      }}
      onReset={(event) => {
        setEdited(false)
        onReset?.(event)
      }}
      onSubmit={async (event) => {
        event.preventDefault()
        setSaving(true)
        try {
          const result = await onSubmit(event)
          if (result !== false) setEdited(false)
        } catch {
          // The command's existing error handler owns feedback; retain the draft.
        } finally {
          setSaving(false)
        }
      }}
    >
      <fieldset className="contents" disabled={saving}>
        {children}
      </fieldset>
    </form>
  )
}
