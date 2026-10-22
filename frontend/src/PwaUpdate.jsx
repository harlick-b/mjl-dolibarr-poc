import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

export function PwaUpdate() {
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
            if (document.documentElement.dataset.authBusy !== 'true')
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
