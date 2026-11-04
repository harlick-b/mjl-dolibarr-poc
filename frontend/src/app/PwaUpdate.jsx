import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/shared/ui/button'

export function PwaUpdate({ queryClient }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <aside
      role="status"
      className="fixed bottom-4 right-4 left-4 mx-auto max-w-xl rounded-panel border border-border bg-white p-4 shadow-lg"
    >
      <p className="mb-3">
        Une nouvelle version est disponible. Terminez votre saisie avant
        d’actualiser.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            const unsaved = [
              ...document.querySelectorAll('form[data-update-blocked="true"]'),
            ].some(
              (form) => !form.closest('dialog') || form.closest('dialog').open,
            )
            if (
              document.documentElement.dataset.authBusy !== 'true' &&
              !unsaved &&
              !queryClient?.isMutating()
            )
              void updateServiceWorker(true)
          }}
        >
          Actualiser l’application
        </Button>
        <button
          className="px-4 underline"
          onClick={() => setNeedRefresh(false)}
        >
          Plus tard
        </button>
      </div>
    </aside>
  )
}
