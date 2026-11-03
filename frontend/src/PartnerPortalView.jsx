import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { sessionKey, sessionQuery } from './auth'
import { formatXof } from './planning'
import { useAPI } from './RestClientProvider'

const emptyList = { data: [] }

function cursor(link) {
  return link
    ? new URL(link, window.location.origin).searchParams.get('cursor') || ''
    : ''
}

function PortalPagination({ page, change, label }) {
  if (!page?.next && !page?.previous) return null
  return (
    <nav className="access-pagination" aria-label={`Pagination ${label}`}>
      <button
        disabled={!page.previous}
        onClick={() => change(cursor(page.previous))}
      >
        Précédent
      </button>
      <button disabled={!page.next} onClick={() => change(cursor(page.next))}>
        Suivant
      </button>
    </nav>
  )
}

function portalQuery(api, key, path, onDenied, enabled = true) {
  return {
    queryKey: ['partner-portal', ...key],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(`/api/v1/partner-portal/${path}`, { signal })
      } catch (error) {
        if (error?.status === 401 || error?.status === 403)
          onDenied(error.status)
        throw error
      }
    },
    enabled,
    retry: false,
    gcTime: 0,
  }
}

export function PartnerPortalView() {
  const { api } = useAPI()
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ from: '/partner' })
  const session = useQuery(sessionQuery)
  const user = session.data?.user
  const permitted =
    session.data?.state === 'verified' && user?.role === 'PARTENAIRE'
  const [blocked, setBlocked] = useState(() => !navigator.onLine)
  const deny = useCallback(
    (status) => {
      setBlocked(true)
      void client.cancelQueries({ queryKey: ['partner-portal'] })
      client.removeQueries({ queryKey: ['partner-portal'] })
      if (status === 401) {
        void client.cancelQueries({ queryKey: sessionKey })
        client.removeQueries({ queryKey: sessionKey })
      }
    },
    [client],
  )
  const profile = useQuery(
    portalQuery(
      api,
      [user?.id, 'profile'],
      'profile',
      deny,
      permitted && !blocked,
    ),
  )
  const projects = useQuery(
    portalQuery(
      api,
      [user?.id, 'projects', search.projectCursor],
      `projects?${new URLSearchParams({
        limit: '60',
        ...(search.projectCursor ? { cursor: search.projectCursor } : {}),
      })}`,
      deny,
      permitted && !blocked,
    ),
  )
  const projectRows = projects.data?.data || emptyList.data
  const selectedProject =
    projectRows.find((item) => item.id === search.project) || projectRows[0]
  const ptas = useQuery(
    portalQuery(
      api,
      [user?.id, 'ptas', selectedProject?.id, search.ptaCursor],
      `projects/${selectedProject?.id}/ptas?${new URLSearchParams({
        limit: '60',
        ...(search.ptaCursor ? { cursor: search.ptaCursor } : {}),
      })}`,
      deny,
      permitted && !blocked && Boolean(selectedProject),
    ),
  )
  const ptaRows = ptas.data?.data || emptyList.data
  const selectedPta =
    ptaRows.find((item) => item.id === search.pta) || ptaRows[0]
  const activities = useQuery(
    portalQuery(
      api,
      [user?.id, 'activities', selectedPta?.id, search.activityCursor],
      `ptas/${selectedPta?.id}/activities?${new URLSearchParams({
        limit: '60',
        ...(search.activityCursor ? { cursor: search.activityCursor } : {}),
      })}`,
      deny,
      permitted && !blocked && Boolean(selectedPta),
    ),
  )

  useEffect(() => {
    if (!permitted) {
      void client.cancelQueries({ queryKey: ['partner-portal'] })
      client.removeQueries({ queryKey: ['partner-portal'] })
    }
  }, [client, permitted])
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

  if (blocked)
    return (
      <div className="planning-error" role="alert">
        Votre accès doit être vérifié avant de réafficher ce portefeuille.
      </div>
    )

  if (session.error?.status === 401 || session.data?.state === 'anonymous')
    return <Navigate to="/login" replace />
  if (session.data?.state === 'pending')
    return <Navigate to="/verification" replace />
  if (session.isError)
    return (
      <div className="planning-error">
        Votre identité n’a pas pu être vérifiée.
      </div>
    )
  if (session.isPending)
    return <p role="status">Vérification de votre accès…</p>
  if (!permitted)
    return (
      <div className="planning-error">
        Cet espace est réservé aux Partenaires.
      </div>
    )

  const queries = [
    profile,
    projects,
    ...(selectedProject ? [ptas] : []),
    ...(selectedPta ? [activities] : []),
  ]
  const loading = queries.some((query) => query.isPending || query.isFetching)
  const unavailable = queries.some((query) => query.isError)
  const changeSearch = (values) =>
    navigate({ to: '/partner', search: { ...search, ...values } })
  return (
    <section className="planning-stack partner-portal">
      <Helmet>
        <title>Espace Partenaire · MJL</title>
      </Helmet>
      <header className="planning-heading">
        <div>
          <p className="partner-eyebrow">Vue d’ensemble</p>
          <h1>Bonjour, {profile.data?.name || 'Partenaire'}</h1>
          <p>Suivez vos Projets, PTA et Activités approuvées.</p>
        </div>
        <span className="partner-readonly">Lecture seule</span>
      </header>
      {loading && <p role="status">Chargement de votre portefeuille…</p>}
      {unavailable && (
        <div className="planning-error" role="alert">
          Votre portefeuille est momentanément indisponible.
        </div>
      )}
      {!loading && !unavailable && !projectRows.length && (
        <article className="planning-card">
          <h2>Aucun Projet approuvé</h2>
          <p>
            Votre portefeuille apparaîtra ici dès qu’un Projet sera disponible.
          </p>
        </article>
      )}
      {!loading && !unavailable && projectRows.length > 0 && (
        <>
          <article className="planning-card">
            <div className="planning-title">
              <div>
                <h2>Mes Projets</h2>
                <p>{projectRows.length} Projet(s) dans votre portefeuille</p>
              </div>
              {projectRows.length > 1 && (
                <label>
                  Projet affiché
                  <select
                    value={selectedProject.id}
                    onChange={(event) => {
                      void changeSearch({
                        project: event.target.value,
                        pta: '',
                        ptaCursor: '',
                        activityCursor: '',
                      })
                    }}
                  >
                    {projectRows.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <dl className="planning-facts">
              <div>
                <dt>Référence</dt>
                <dd>{selectedProject.reference}</dd>
              </div>
              <div>
                <dt>Projet</dt>
                <dd>{selectedProject.name}</dd>
              </div>
              <div>
                <dt>État</dt>
                <dd>
                  {selectedProject.state === 'closed' ? 'Clôturé' : 'Actif'}
                </dd>
              </div>
            </dl>
            <PortalPagination
              page={projects.data}
              label="Projets"
              change={(projectCursor) =>
                changeSearch({
                  projectCursor,
                  project: '',
                  pta: '',
                  ptaCursor: '',
                  activityCursor: '',
                })
              }
            />
          </article>
          {selectedPta ? (
            <article className="planning-card">
              <div className="planning-title">
                <div>
                  <h2>PTA {selectedPta.year}</h2>
                  <p>
                    {selectedPta.metrics.physical.closed_activities} activité
                    clôturée sur{' '}
                    {selectedPta.metrics.physical.approved_activities}
                  </p>
                </div>
                {ptaRows.length > 1 && (
                  <label>
                    Année
                    <select
                      value={selectedPta.id}
                      onChange={(event) =>
                        void changeSearch({
                          pta: event.target.value,
                          activityCursor: '',
                        })
                      }
                    >
                      {ptaRows.map((pta) => (
                        <option key={pta.id} value={pta.id}>
                          {pta.year}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <PortalPagination
                page={ptas.data}
                label="PTA"
                change={(ptaCursor) =>
                  changeSearch({ ptaCursor, pta: '', activityCursor: '' })
                }
              />
              <div className="annual-metrics">
                <article>
                  <h3>Avancement physique</h3>
                  <strong>
                    {selectedPta.metrics.physical.closed_activities} /{' '}
                    {selectedPta.metrics.physical.approved_activities}
                  </strong>
                  <p>Activités clôturées et approuvées</p>
                </article>
                <article>
                  <h3>Exécution financière</h3>
                  <strong>
                    {formatXof(selectedPta.metrics.financial.closed_spending)}
                  </strong>
                  <p>
                    sur{' '}
                    {formatXof(
                      selectedPta.metrics.financial.approved_allocation,
                    )}{' '}
                    approuvés
                  </p>
                </article>
              </div>
              <h3>Activités approuvées</h3>
              {activities.data?.data.length ? (
                <ul className="planning-list">
                  {activities.data.data.map((activity) => (
                    <li key={activity.id}>
                      <div>
                        <strong>{activity.name}</strong>
                        <small>
                          {activity.reference} · du {activity.planned_start} au{' '}
                          {activity.planned_end}
                        </small>
                      </div>
                      <span>
                        {activity.state === 'closed' ? 'Clôturée' : 'Approuvée'}{' '}
                        · {formatXof(activity.allocation)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Aucune Activité approuvée pour ce PTA.</p>
              )}
              <PortalPagination
                page={activities.data}
                label="Activités"
                change={(activityCursor) => changeSearch({ activityCursor })}
              />
            </article>
          ) : (
            <article className="planning-card">
              <h2>Aucun PTA disponible</h2>
            </article>
          )}
        </>
      )}
    </section>
  )
}
