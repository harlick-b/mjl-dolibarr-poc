import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { sessionKey, sessionQuery } from './auth'
import { cursorFrom } from './pagination'
import { useAPI } from './RestClientProvider'

const historyRoot = ['audit-history']

const outcomeLabels = {
  ok: 'Succès',
  sent: 'Envoyé',
  failed: 'Échec enregistré',
  pending: 'En attente',
  limited: 'Limité',
}

export function AuditHistoryView() {
  const client = useQueryClient()
  const session = useQuery(sessionQuery)
  const [blocked, setBlocked] = useState(!navigator.onLine)
  const deny = useCallback(() => {
    setBlocked(true)
    void client.cancelQueries({ queryKey: historyRoot })
    client.removeQueries({ queryKey: historyRoot })
    client.removeQueries({ queryKey: sessionKey, exact: true })
  }, [client])
  useEffect(() => {
    const clear = () => deny()
    const channel = new BroadcastChannel('mjl-auth')
    channel.onmessage = clear
    window.addEventListener('offline', clear)
    const timer = session.data?.expires_at
      ? setTimeout(
          clear,
          Math.max(0, Date.parse(session.data.expires_at) - Date.now()),
        )
      : undefined
    return () => {
      channel.close()
      window.removeEventListener('offline', clear)
      clearTimeout(timer)
    }
  }, [deny, session.data?.expires_at])
  useEffect(() => {
    if (session.isError || session.data?.state !== 'verified') {
      void client.cancelQueries({ queryKey: historyRoot })
      client.removeQueries({ queryKey: historyRoot })
    }
  }, [client, session.data?.state, session.isError])
  if (blocked)
    return (
      <section>
        <h1>Vérification de l’accès</h1>
        <p>Reconnectez-vous au service pour consulter l’historique.</p>
      </section>
    )
  if (session.isPending) return <p role="status">Vérification de l’accès…</p>
  if (session.error?.status === 401 || session.data?.state === 'anonymous')
    return <Navigate to="/login" replace />
  if (session.data?.state === 'pending')
    return <Navigate to="/verification" replace />
  if (session.isError) return <p role="alert">L’identité est indisponible.</p>
  if (
    !['ADMIN_PLATEFORME', 'VALIDATEUR_DEFINITIF'].includes(
      session.data.user.role,
    )
  )
    return <p role="alert">Vous n’avez pas accès à l’historique global.</p>
  return <History session={session.data} onDenied={deny} />
}

function History({ session, onDenied }) {
  const { api } = useAPI()
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const cursor = search.cursor || ''
  const canOpenActivity = session.user.role === 'VALIDATEUR_DEFINITIF'
  const result = useQuery({
    queryKey: [...historyRoot, session.user.id, cursor, 60],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(
          `/api/v1/audit-events${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
          { signal },
        )
      } catch (error) {
        if (error.status === 401 || error.status === 403) onDenied()
        throw error
      }
    },
    gcTime: 0,
  })
  if (result.isPending) return <p role="status">Chargement de l’historique…</p>
  if (result.isError)
    return <p role="alert">L’historique est momentanément indisponible.</p>
  const move = (link) =>
    navigate({
      to: '/history',
      search: { cursor: cursorFrom(link, '/audit-events') },
    })
  return (
    <section className="planning-stack">
      <Helmet>
        <title>Historique — MJL</title>
      </Helmet>
      <div className="planning-heading">
        <div>
          <p className="eyebrow">Traçabilité</p>
          <h1>Historique</h1>
        </div>
      </div>
      <div className="planning-card audit-history-card">
        <p>
          <strong>{result.data.count}</strong> événements
        </p>
        {result.data.data.length === 0 ? (
          <p>Aucun événement enregistré.</p>
        ) : (
          <ol className="audit-history-list">
            {result.data.data.map((item) => (
              <li key={item.id}>
                <time dateTime={item.occurred_at}>
                  {new Intl.DateTimeFormat('fr-FR', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  }).format(new Date(item.occurred_at))}
                </time>
                <div>
                  <strong>{item.label}</strong>
                  <small>
                    {outcomeLabels[item.outcome] || 'Résultat enregistré'}
                  </small>
                </div>
                <div>
                  {item.activity && canOpenActivity ? (
                    <Link
                      to="/activities/$activityId"
                      params={{ activityId: item.activity.id }}
                    >
                      {item.activity.reference} — {item.activity.name}
                    </Link>
                  ) : item.activity ? (
                    <span>
                      {item.activity.reference} — {item.activity.name}
                    </span>
                  ) : (
                    <span>Événement général</span>
                  )}
                </div>
                <div>
                  {item.actor ? (
                    <span>{item.actor.email}</span>
                  ) : (
                    <span>Système</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        <nav className="planning-actions" aria-label="Pages de l’historique">
          <button
            type="button"
            disabled={!result.data.previous}
            onClick={() => move(result.data.previous)}
          >
            Précédent
          </button>
          <button
            type="button"
            disabled={!result.data.next}
            onClick={() => move(result.data.next)}
          >
            Suivant
          </button>
        </nav>
      </div>
    </section>
  )
}
