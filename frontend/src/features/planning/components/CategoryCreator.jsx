import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import { Modal } from '@/shared/ui/BusinessModal'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Button } from '@/shared/ui/button'
import { strings } from '@/locales/fr/PlanningView'
import { toast } from 'sonner'

export function CategoryCreator({ onCreate, onCreated, disabled }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const opener = useRef(null)
  const generation = useRef(0)
  const close = () => {
    generation.current += 1
    setOpen(false)
  }
  return (
    <>
      <Button
        ref={opener}
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start self-end"
        disabled={disabled}
        onClick={() => {
          setError('')
          setOpen(true)
        }}
      >
        <Plus size={16} aria-hidden="true" />
        {strings.createCategory}
      </Button>
      {open &&
        createPortal(
          <Modal
            open
            onClose={close}
            label={strings.createCategory}
            opener={opener}
          >
            <BusinessForm
              onSubmit={async (event) => {
                event.stopPropagation()
                const current = generation.current
                const data = new FormData(event.currentTarget)
                setError('')
                try {
                  const type = await onCreate({
                    label: data.get('label'),
                    description: data.get('description') || null,
                  })
                  if (current !== generation.current) return
                  onCreated(type)
                  toast.success(strings.categoryCreated)
                  close()
                  opener.current?.focus()
                } catch (problem) {
                  if (
                    current === generation.current &&
                    problem.name !== 'AbortError'
                  )
                    setError(problem.message || strings.unavailablePlanning)
                  throw problem
                }
              }}
            >
              <label>
                {strings.name} *
                <input name="label" required maxLength={200} autoFocus />
              </label>
              <label>
                {strings.description}
                <textarea name="description" maxLength={4000} rows={3} />
              </label>
              {error && (
                <p role="alert" className="text-danger">
                  {error}
                </p>
              )}
              <div data-ui="modal-actions">
                <Button type="button" variant="outline" onClick={close}>
                  {strings.cancel}
                </Button>
                <Button type="submit">{strings.save}</Button>
              </div>
            </BusinessForm>
          </Modal>,
          document.body,
        )}
    </>
  )
}
