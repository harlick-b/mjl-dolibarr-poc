import { PageLoading, LoadingPlaceholder } from '@/shared/ui/PageLoading'
import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { sessionKey, sessionQuery } from '@/features/auth/auth'
import { formatXof } from '@/shared/lib/format'
import { strings } from '@/shared/i18n'
import { useAPI } from '@/shared/api/RestClientProvider'
import { AccessRecovery } from '@/features/auth/AccessRecovery'
import { PartnerDocuments } from './PartnerDocuments'

const emptyList = { data: [] }

class DownloadGuard {
  generation = 0
  controller = null
  urls = new Set()

  begin() {
    this.generation += 1
    this.controller?.abort()
    this.controller = new AbortController()
    return { generation: this.generation, signal: this.controller.signal }
  }

  current(generation) {
    return generation === this.generation
  }

  revoke() {
    this.generation += 1
    this.controller?.abort()
    this.controller = null
    for (const url of this.urls) URL.revokeObjectURL(url)
    this.urls.clear()
  }
}

function formatDate(value) {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])))
}

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
  const [downloadGuard] = useState(() => new DownloadGuard())
  const deny = useCallback(
    (status) => {
      downloadGuard.revoke()
      setBlocked(true)
      void client.cancelQueries({ queryKey: ['partner-portal'] })
      client.removeQueries({ queryKey: ['partner-portal'] })
      client.getMutationCache().clear()
      if (status === 401) {
        void client.cancelQueries({ queryKey: sessionKey })
        client.removeQueries({ queryKey: sessionKey })
      }
    },
    [client, downloadGuard],
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
  const activityRows = activities.data?.data || emptyList.data
  const selectedActivityId = activityRows.some(
    (activity) => activity.id === search.activity,
  )
    ? search.activity
    : ''
  const detail = useQuery(
    portalQuery(
      api,
      [user?.id, 'detail', selectedActivityId],
      `activities/${selectedActivityId}`,
      deny,
      permitted && !blocked && Boolean(selectedActivityId),
    ),
  )
  const fiche = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: async (activityId) => {
      if (!navigator.onLine) throw new TypeError('Offline')
      const request = downloadGuard.begin()
      const { blob, filename } = await api.download(
        `/api/v1/partner-portal/activities/${activityId}/fiche.pdf`,
        { signal: request.signal },
      )
      if (!downloadGuard.current(request.generation))
        throw new DOMException('Stale authorization', 'AbortError')
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 0)
      return null
    },
    onError: (error) => {
      if (error?.status === 401 || error?.status === 403) deny(error.status)
    },
  })

  const csvExport = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: async (ptaId) => {
      if (!navigator.onLine) throw new TypeError('Offline')
      const request = downloadGuard.begin()
      const { blob, filename } = await api.download(
        `/api/v1/partner-portal/ptas/${ptaId}/exports`,
        {
          method: 'POST',
          csrf: session.data?.csrf,
          body: { format: 'csv' },
          signal: request.signal,
        },
      )
      if (!downloadGuard.current(request.generation))
        throw new DOMException('Stale authorization', 'AbortError')
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 0)
    },
    onError: (error) => {
      if (error?.status === 401 || error?.status === 403) deny(error.status)
    },
  })
  useEffect(() => {
    return () => downloadGuard.revoke()
  }, [downloadGuard, selectedProject?.id, selectedPta?.id])

  useEffect(() => {
    if (!permitted) {
      downloadGuard.revoke()
      void client.cancelQueries({ queryKey: ['partner-portal'] })
      client.removeQueries({ queryKey: ['partner-portal'] })
      client.getMutationCache().clear()
    }
  }, [client, downloadGuard, permitted])
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
      downloadGuard.revoke()
      channel.close()
      window.removeEventListener('offline', clear)
      clearTimeout(timer)
    }
  }, [deny, downloadGuard, session.data?.expires_at])

  if (blocked)
    return (
      <div className="planning-error" role="alert">
        Votre accès doit être vérifié avant de réafficher ce portefeuille.
        <AccessRecovery
          session={session}
          onVerified={() => setBlocked(false)}
        />
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
  if (session.isPending) return <PartnerLoading />
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
    ...(selectedActivityId ? [detail] : []),
  ]
  const loading = queries.some((query) => query.isPending || query.isFetching)
  const unavailable = queries.some((query) => query.isError)
  const changeSearch = (values) => {
    downloadGuard.revoke()
    return navigate({
      to: '/partner',
      search: {
        ...search,
        ...(Object.keys(values).some((key) =>
          [
            'activity',
            'project',
            'pta',
            'activityCursor',
            'ptaCursor',
            'projectCursor',
          ].includes(key),
        )
          ? { documentCursor: '' }
          : {}),
        ...values,
      },
    })
  }
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
      {loading && (
        <LoadingPlaceholder
          label={strings.formatString(strings.pageLoading, {
            page: strings.partnerTitle,
          })}
          variant="detail"
        />
      )}
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
                        activity: '',
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
                  activity: '',
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
                  <button
                    type="button"
                    disabled={csvExport.isPending}
                    onClick={() => csvExport.mutate(selectedPta.id)}
                  >
                    {csvExport.isPending
                      ? strings.partnerPtaCsvPending
                      : strings.partnerPtaCsv}
                  </button>
                  {csvExport.isError &&
                    csvExport.error?.name !== 'AbortError' && (
                      <p role="alert">{strings.partnerPtaCsvFailed}</p>
                    )}
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
                          activity: '',
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
                  changeSearch({
                    ptaCursor,
                    pta: '',
                    activity: '',
                    activityCursor: '',
                  })
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
                  {activityRows.map((activity) => (
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
                      <button
                        type="button"
                        onClick={() =>
                          void changeSearch({ activity: activity.id })
                        }
                      >
                        Voir le détail
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Aucune Activité approuvée pour ce PTA.</p>
              )}
              <PortalPagination
                page={activities.data}
                label="Activités"
                change={(activityCursor) =>
                  changeSearch({ activityCursor, activity: '' })
                }
              />
            </article>
          ) : (
            <article className="planning-card">
              <h2>Aucun PTA disponible</h2>
            </article>
          )}
          {detail.data && (
            <article className="planning-card" aria-labelledby="partner-detail">
              <div className="planning-title">
                <div>
                  <p className="partner-eyebrow">Activité approuvée</p>
                  <h2 id="partner-detail">{detail.data.name}</h2>
                  <p>{detail.data.description}</p>
                </div>
                <button
                  type="button"
                  disabled={fiche.isPending}
                  onClick={() => fiche.mutate(detail.data.id)}
                >
                  {fiche.isPending
                    ? 'Préparation…'
                    : 'Télécharger la fiche PDF'}
                </button>
              </div>
              {fiche.isError && (
                <p className="planning-error" role="alert">
                  La fiche est momentanément indisponible.
                </p>
              )}
              <dl className="planning-facts">
                <div>
                  <dt>Référence</dt>
                  <dd>{detail.data.reference}</dd>
                </div>
                <div>
                  <dt>Période</dt>
                  <dd>
                    Du {formatDate(detail.data.planned_start)} au{' '}
                    {formatDate(detail.data.planned_end)}
                  </dd>
                </div>
                <div>
                  <dt>Budget approuvé</dt>
                  <dd>{formatXof(detail.data.allocation)}</dd>
                </div>
              </dl>
              <h3>Opérations approuvées</h3>
              <ul className="planning-list">
                {detail.data.operations.map((operation, index) => (
                  <li key={`${operation.name}-${index}`}>
                    <div>
                      <strong>{operation.name}</strong>
                      <small>{operation.description}</small>
                    </div>
                    <span>
                      {operation.final_spending == null
                        ? formatXof(operation.allocation)
                        : `${formatXof(operation.final_spending)} dépensés`}
                    </span>
                  </li>
                ))}
              </ul>
              <h3>Décisions finales</h3>
              <ul className="planning-list">
                {detail.data.decisions.map((decision) => (
                  <li key={`${decision.kind}-${decision.revision}`}>
                    <strong>
                      {decision.kind === 'initial'
                        ? 'Planification approuvée'
                        : decision.kind === 'amendment'
                          ? 'Modification approuvée'
                          : 'Transfert annuel approuvé'}
                    </strong>
                    <span>
                      Révision {decision.revision} ·{' '}
                      {formatDate(decision.decided_at)}
                    </span>
                  </li>
                ))}
              </ul>
              <PartnerDocuments
                key={`${user.id}:${detail.data.id}`}
                activityId={detail.data.id}
                userId={user.id}
                cursor={search.documentCursor}
                changeCursor={(documentCursor) =>
                  changeSearch({ documentCursor })
                }
                guard={downloadGuard}
                onDenied={deny}
              />
              <h3>Résultat financier</h3>
              {detail.data.finance ? (
                <dl className="planning-facts">
                  <div>
                    <dt>Dépenses finales</dt>
                    <dd>{formatXof(detail.data.finance.final_spending)}</dd>
                  </div>
                  {detail.data.finance.zero_spending && (
                    <div>
                      <dt>Parcours validé</dt>
                      <dd>Dépense nulle validée</dd>
                    </div>
                  )}
                  <div>
                    <dt>Virement confirmé</dt>
                    <dd>
                      {detail.data.finance.confirmed_transfer_amount == null
                        ? 'Aucun virement requis'
                        : `${formatXof(
                            detail.data.finance.confirmed_transfer_amount,
                          )} · ${formatDate(
                            detail.data.finance.confirmed_transfer_date,
                          )}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Surplus à reverser</dt>
                    <dd>
                      {formatXof(detail.data.finance.reversement_required)}
                    </dd>
                  </div>
                  <div>
                    <dt>Surplus reversé</dt>
                    <dd>
                      {detail.data.finance.reversement_amount == null
                        ? 'Aucun reversement requis'
                        : `${formatXof(
                            detail.data.finance.reversement_amount,
                          )} · ${formatDate(
                            detail.data.finance.reversement_date,
                          )}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Clôture</dt>
                    <dd>{formatDate(detail.data.finance.closed_at)}</dd>
                  </div>
                </dl>
              ) : (
                <p>Le résultat financier sera disponible après la clôture.</p>
              )}
            </article>
          )}
        </>
      )}
    </section>
  )
}

export function PartnerLoading() {
  return <PageLoading title={strings.partnerTitle} variant="detail" />
}
