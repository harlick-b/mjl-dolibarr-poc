import { Select } from '@/shared/ui/select'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { Button } from '@/shared/ui/button'
import { Panel } from '@/shared/ui/layout'
import { useSessionQuery } from '@/features/auth/SessionProvider'
import { authorization } from '@/features/auth/authorization'
import { PageLoading, LoadingPlaceholder } from '@/shared/ui/PageLoading'
import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { formatXof } from '@/shared/lib/format'
import { strings } from '@/locales/fr/PartnerPortalView'
import { strings as common } from '@/locales/fr/common'
import { useAPI } from '@/shared/api/RestClientProvider'
import { PartnerDocuments } from './PartnerDocuments'
import { useProtectedCleanup } from '@/features/auth/access-verification'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/AccessDeniedState'

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
    <nav
      className="[&_button]:min-h-11 [&_button]:text-primary [&_button]:underline flex justify-end flex-wrap items-center gap-4 mt-3 mr-0 mb-10 ml-0 text-[0.8125rem]"
      aria-label={`Pagination ${label}`}
    >
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
  const queryKey = ['partner-portal', ...key]
  return {
    queryKey,
    queryFn: async ({ signal }) => {
      try {
        return await api.request(`/api/v1/partner-portal/${path}`, { signal })
      } catch (error) {
        if ([401, 403, 404].includes(error?.status))
          onDenied(error.status, queryKey)
        throw error
      }
    },
    enabled,
    retry: false,
  }
}

export function PartnerPortalView({ screen = 'projects' }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const session = useSessionQuery()
  const user = session.data?.user
  const permitted = authorization(session.data).can('partner')
  const [downloadGuard] = useState(() => new DownloadGuard())
  useProtectedCleanup(() => downloadGuard.revoke())
  const deny = useCallback(
    (status, queryKey) => {
      downloadGuard.revoke()
      if (![403, 404].includes(status) || !queryKey) return
      if (queryKey[2] === 'profile')
        client.setQueriesData({ queryKey: ['partner-portal', user?.id] }, null)
      else client.setQueryData(queryKey, null)
    },
    [client, downloadGuard, user?.id],
  )
  const profile = useQuery(
    portalQuery(api, [user?.id, 'profile'], 'profile', deny, permitted),
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
      permitted,
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
      permitted && Boolean(selectedProject),
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
      permitted && Boolean(selectedPta) && screen !== 'exports',
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
      permitted && Boolean(selectedActivityId) && screen !== 'exports',
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
      if (error?.status === 401) deny(error.status)
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
      if (error?.status === 401) deny(error.status)
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
  if (session.isPending) return <PartnerLoading />
  if (!permitted) return <AccessDeniedState role={user?.role} />

  const primaryQueries = [profile, projects]
  const changeSearch = (values) => {
    downloadGuard.revoke()
    return navigate({
      to: screen === 'exports' ? '/partner/exports' : '/partner',
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
  if (primaryQueries.some((query) => query.isError))
    return (
      <RetryableError
        page
        onRetry={() =>
          void Promise.all(
            primaryQueries
              .filter((query) => query.isError)
              .map((query) => query.refetch()),
          )
        }
      >
        {strings.portfolioUnavailable}
      </RetryableError>
    )
  if (primaryQueries.some((query) => query.isPending))
    return <PageLoading title={strings.partnerTitle} />
  if (screen === 'exports')
    return (
      <section className="grid gap-6">
        <Helmet>
          <title>{`${strings.exportsTitle} - MJL`}</title>
        </Helmet>
        <h1 className="text-2xl font-semibold text-navy">
          {strings.exportsTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile.data?.name} · {strings.approvedData}
        </p>
        {!selectedProject ? (
          <Panel className="p-0">
            <EmptyContent kind="projects" />
          </Panel>
        ) : (
          <>
            <Panel className="border-0 bg-transparent p-0 flex flex-wrap gap-4">
              <label className="w-full max-w-120">
                {strings.projectLabel}
                <Select
                  value={selectedProject.id}
                  onChange={(event) =>
                    void changeSearch({
                      project: event.target.value,
                      pta: '',
                      ptaCursor: '',
                    })
                  }
                >
                  {projectRows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </Select>
              </label>
              {selectedPta && (
                <label>
                  {strings.ptaLabel}
                  <Select
                    value={selectedPta.id}
                    onChange={(event) =>
                      void changeSearch({ pta: event.target.value })
                    }
                  >
                    {ptaRows.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.year}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </Panel>
            <PortalPagination
              page={projects.data}
              label={strings.projectLabel}
              change={(projectCursor) =>
                changeSearch({
                  projectCursor,
                  project: '',
                  pta: '',
                  ptaCursor: '',
                })
              }
            />
            {ptas.isPending ? (
              <PageLoading title={strings.exportsTitle} className="min-h-45" />
            ) : ptas.isError ? (
              <RetryableError onRetry={() => void ptas.refetch()}>
                {strings.ptasUnavailable}
              </RetryableError>
            ) : selectedPta ? (
              <Panel className="p-0 gap-0">
                <h2 className="border-b border-border p-5">
                  {strings.ptaLabel} {selectedPta.year}
                </h2>
                <div className="grid gap-4 p-5">
                  <p className="text-sm">
                    {selectedPta.metrics.physical.approved_activities}{' '}
                    {strings.approvedActivities} · {selectedProject.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={csvExport.isPending}
                      aria-busy={csvExport.isPending}
                      onClick={() => csvExport.mutate(selectedPta.id)}
                    >
                      {csvExport.isPending
                        ? strings.partnerPtaCsvPending
                        : strings.partnerPtaCsv}
                    </Button>
                    <Button asChild variant="outline">
                      <Link
                        to="/partner"
                        search={{
                          project: selectedProject.id,
                          pta: selectedPta.id,
                        }}
                      >
                        {strings.consultFiches}
                      </Link>
                    </Button>
                  </div>
                  {csvExport.isError && (
                    <p role="alert">{strings.partnerPtaCsvFailed}</p>
                  )}
                </div>
              </Panel>
            ) : (
              <Panel className="p-0">
                <EmptyContent kind="ptas" />
              </Panel>
            )}
            <PortalPagination
              page={ptas.data}
              label={strings.ptaLabel}
              change={(ptaCursor) => changeSearch({ ptaCursor, pta: '' })}
            />
          </>
        )}
      </section>
    )
  return (
    <section className="grid gap-6 [&_[data-ui~='planning-list']_li]:flex [&_[data-ui~='planning-list']_li]:justify-between [&_[data-ui~='planning-list']_li]:gap-6 [&_[data-ui~='planning-list']_div]:grid [&_[data-ui~='planning-list']_div]:gap-1 [&_[data-ui~='planning-list']_small]:text-muted-foreground [&_[data-ui~='planning-list']_span]:text-muted-foreground">
      <Helmet>
        <title>Espace Partenaire - MJL</title>
      </Helmet>
      <header
        className="flex justify-between items-center gap-5 flex-wrap [&_h1]:text-navy [&_h1]:font-semibold [&_h1]:text-[1.75rem] [&_nav]:flex [&_nav]:gap-5 max-[641px]:items-start"
        data-ui="planning-heading"
      >
        <div>
          <p className="mt-0 mr-0 mb-[6px] ml-0 text-primary text-[0.8125rem] font-semibold uppercase tracking-[0.04em]">
            Vue d’ensemble
          </p>
          <h1>
            Bonjour,{' '}
            {!profile.isError && profile.data?.name
              ? profile.data.name
              : 'Partenaire'}
          </h1>
          <p>Suivez vos Projets, PTA et Activités approuvées.</p>
        </div>
        <span className="border border-border rounded-full py-[7px] px-3 bg-white text-muted-foreground text-[0.8125rem]">
          Lecture seule
        </span>
      </header>
      {!projectRows.length && (
        <Panel as="article">
          <EmptyContent kind="projects" />
        </Panel>
      )}
      {projectRows.length > 0 && (
        <>
          <Panel as="article">
            <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
              <div>
                <h2>Mes Projets</h2>
                <p>{projectRows.length} Projet(s) dans votre portefeuille</p>
              </div>
              {projectRows.length > 1 && (
                <label>
                  Projet affiché
                  <Select
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
                  </Select>
                </label>
              )}
            </div>
            <dl className="flex gap-8 flex-wrap [&_dt]:text-muted-foreground [&_dt]:text-[0.8125rem]">
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
          </Panel>
          {ptas.isError ? (
            <RetryableError onRetry={() => void ptas.refetch()}>
              {strings.ptasUnavailable}
            </RetryableError>
          ) : ptas.isPending ? (
            <LoadingPlaceholder
              label={strings.formatString(common.pageLoading, {
                page: strings.ptaLabel,
              })}
            />
          ) : selectedPta ? (
            <Panel as="article">
              <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
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
                    <Select
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
                    </Select>
                  </label>
                )}
              </div>
              <PortalPagination
                page={ptas.data}
                label={strings.ptaLabel}
                change={(ptaCursor) =>
                  changeSearch({
                    ptaCursor,
                    pta: '',
                    activity: '',
                    activityCursor: '',
                  })
                }
              />
              <div className="grid grid-cols-[repeat(auto-fit,_minmax(min(100%,_280px),_1fr))] gap-6 [&_article]:border [&_article]:border-border [&_article]:rounded-panel [&_article]:p-6 [&_h3]:m-0 [&_h3]:text-navy [&_h3]:text-[15px] [&_h3]:font-semibold [&_strong]:block [&_strong]:mt-3 [&_strong]:text-navy [&_strong]:text-[2rem] [&_strong]:leading-[1.2] [&_p]:mt-3 [&_p]:mr-0 [&_p]:mb-0 [&_p]:ml-0 [&_p]:text-muted-foreground [&_p]:text-sm">
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
              {activities.isError ? (
                <RetryableError onRetry={() => void activities.refetch()}>
                  {strings.activitiesUnavailable}
                </RetryableError>
              ) : activities.isPending ? (
                <LoadingPlaceholder
                  label={strings.formatString(common.pageLoading, {
                    page: strings.activitiesLabel,
                  })}
                />
              ) : activities.data?.data.length ? (
                <ul
                  className="grid gap-0 p-0 list-none [&_li]:min-h-13 [&_li]:border-t [&_li]:border-t-border [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4"
                  data-ui="planning-list"
                >
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
                <EmptyContent kind="execution" large />
              )}
              <PortalPagination
                page={activities.data}
                label={strings.activitiesLabel}
                change={(activityCursor) =>
                  changeSearch({ activityCursor, activity: '' })
                }
              />
            </Panel>
          ) : (
            <Panel as="article">
              <h2>Aucun PTA disponible</h2>
            </Panel>
          )}
          {detail.isError && (
            <RetryableError onRetry={() => void detail.refetch()}>
              {strings.detailUnavailable}
            </RetryableError>
          )}
          {detail.isPending && selectedActivityId && (
            <LoadingPlaceholder
              label={strings.formatString(common.pageLoading, {
                page: strings.activityDetailLabel,
              })}
              variant="detail"
            />
          )}
          {detail.data && (
            <Panel as="article" aria-labelledby="partner-detail">
              <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
                <div>
                  <p className="mt-0 mr-0 mb-[6px] ml-0 text-primary text-[0.8125rem] font-semibold uppercase tracking-[0.04em]">
                    Activité approuvée
                  </p>
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
                <p
                  className="border-l-4 border-l-danger p-3 bg-white"
                  role="alert"
                >
                  La fiche est momentanément indisponible.
                </p>
              )}
              <dl className="flex gap-8 flex-wrap [&_dt]:text-muted-foreground [&_dt]:text-[0.8125rem]">
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
              <ul
                className="grid gap-0 p-0 list-none [&_li]:min-h-13 [&_li]:border-t [&_li]:border-t-border [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4"
                data-ui="planning-list"
              >
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
              <ul
                className="grid gap-0 p-0 list-none [&_li]:min-h-13 [&_li]:border-t [&_li]:border-t-border [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4"
                data-ui="planning-list"
              >
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
                <dl className="flex gap-8 flex-wrap [&_dt]:text-muted-foreground [&_dt]:text-[0.8125rem]">
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
            </Panel>
          )}
        </>
      )}
    </section>
  )
}

export function PartnerLoading() {
  return <PageLoading title={strings.partnerTitle} variant="detail" />
}
