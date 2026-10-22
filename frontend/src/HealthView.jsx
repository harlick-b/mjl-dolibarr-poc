import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, RefreshCw } from 'lucide-react'
import { healthQuery } from './health'
import { Button } from '@/components/ui/button'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}
const onlineSnapshot = () => navigator.onLine

export function HealthView() {
  const online = useSyncExternalStore(subscribe, onlineSnapshot)
  const query = useQuery(healthQuery)
  let message = 'Service disponible'
  if (!online) message = 'Hors connexion — service indisponible'
  else if (query.isFetching || query.isPending)
    message = 'Vérification en cours…'
  else if (query.isError)
    message =
      query.error.message === 'unavailable'
        ? 'Service indisponible'
        : 'Erreur de vérification'

  return (
    <section className="rounded-card border border-border bg-white p-8">
      <h1 className="flex items-center gap-3 text-2xl font-semibold text-navy">
        <Activity aria-hidden="true" /> État du service
      </h1>
      <p role="status" aria-live="polite" className="mt-6 font-semibold">
        {message}
      </p>
      {online && query.isSuccess && !query.isFetching && (
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière vérification :{' '}
          {new Date(query.dataUpdatedAt).toLocaleTimeString('fr-FR')}.
          Vérification toutes les 10 secondes.
        </p>
      )}
      <Button
        className="mt-6"
        onClick={() => query.refetch()}
        disabled={!online || query.isFetching}
      >
        <RefreshCw size={16} aria-hidden="true" /> Vérifier maintenant
      </Button>
    </section>
  )
}
