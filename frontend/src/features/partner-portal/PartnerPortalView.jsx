import { Urls } from '@/app/urls'
import { Select } from '@/shared/ui/select'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { Button } from '@/shared/ui/button'
import { Panel } from '@/shared/ui/layout'
import { useSessionQuery } from '@/features/auth/session/SessionProvider'
import { authorization } from '@/features/auth/session/authorization'
import { PageLoading, LoadingPlaceholder } from '@/shared/ui/PageLoading'
import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { formatDate, formatXof } from '@/shared/lib/format'
import { strings } from '@/locales/fr/PartnerPortalView'
import { strings as common } from '@/locales/fr/common'
import { useAPI } from '@/shared/api/RestClientProvider'
import { PartnerDocuments } from './PartnerDocuments'
import { useProtectedCleanup } from '@/features/auth/session/access-verification'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'
import { ProtectedFilePreview } from '@/shared/ui/ProtectedFilePreview'
import { Pagination } from '@/shared/ui/Pagination'
import { cursorFrom, findPaginatedItem } from '@/shared/lib/pagination'
import { deliverBlobDownload } from '@/shared/lib/download'

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

function PortalPagination({ page, change, label, path }) {
  return (
    <Pagination
      className="justify-end mt-3 mb-10"
      label={`Pagination ${label}`}
      canPrevious={Boolean(page?.previous)}
      canNext={Boolean(page?.next)}
      onPrevious={() => change(cursorFrom(page.previous, path))}
      onNext={() => change(cursorFrom(page.next, path))}
    />
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

function portalSelectionQuery({
  api,
  key,
  path,
  id,
  firstPage,
  onDenied,
  enabled,
}) {
  const queryKey = ['partner-portal', ...key]
  return {
    queryKey,
    queryFn: async ({ signal }) => {
      try {
        return await findPaginatedItem({ api, path, id, signal, firstPage })
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
  const [ficheScope, setFicheScope] = useState(() => new AbortController())
  const [cursors, setCursors] = useState({
    projectCursor: '',
    ptaCursor: '',
    activityCursor: '',
    documentCursor: '',
  })
  useProtectedCleanup(() => downloadGuard.revoke())
  useProtectedCleanup(() => ficheScope.abort())
  const deny = useCallback(
    (status, queryKey) => {
      downloadGuard.revoke()
      ficheScope.abort()
      setFicheScope(new AbortController())
      if (![403, 404].includes(status) || !queryKey) return
      if (queryKey[2] === 'profile')
        client.setQueriesData({ queryKey: ['partner-portal', user?.id] }, null)
      else if (String(queryKey[2]).startsWith('selected-')) {
        client.setQueriesData(
          {
            queryKey: ['partner-portal', user?.id],
            predicate: (query) =>
              !query.queryKey.every(
                (part, index) => part === queryKey[index],
              ) || query.queryKey.length !== queryKey.length,
          },
          null,
        )
      } else {
        client.setQueryData(queryKey, null)
        if (queryKey[2] === 'detail') {
          const documentsKey = [
            'partner-portal',
            user?.id,
            'documents',
            queryKey[3],
          ]
          void client.cancelQueries({ queryKey: documentsKey })
          client.removeQueries({ queryKey: documentsKey })
        }
      }
    },
    [client, downloadGuard, ficheScope, user?.id],
  )
  const profile = useQuery(
    portalQuery(api, [user?.id, 'profile'], 'profile', deny, permitted),
  )
  const projects = useQuery(
    portalQuery(
      api,
      [user?.id, 'projects', cursors.projectCursor],
      `projects?${new URLSearchParams({
        limit: '60',
        ...(cursors.projectCursor ? { cursor: cursors.projectCursor } : {}),
      })}`,
      deny,
      permitted,
    ),
  )
  const projectRows = projects.data?.data || emptyList.data
  const projectOnPage = projectRows.find((item) => item.id === search.project)
  const selectedProjectQuery = useQuery(
    portalSelectionQuery({
      api,
      key: [user?.id, 'selected-project', search.project],
      path: '/partner-portal/projects',
      id: search.project,
      firstPage: cursors.projectCursor ? undefined : projects.data,
      onDenied: deny,
      enabled: Boolean(
        permitted && search.project && projects.data && !projectOnPage,
      ),
    }),
  )
  const selectedProject = search.project
    ? projectOnPage || selectedProjectQuery.data
    : projectRows[0]
  const ptas = useQuery(
    portalQuery(
      api,
      [user?.id, 'ptas', selectedProject?.id, cursors.ptaCursor],
      `projects/${selectedProject?.id}/ptas?${new URLSearchParams({
        limit: '60',
        ...(cursors.ptaCursor ? { cursor: cursors.ptaCursor } : {}),
      })}`,
      deny,
      permitted && Boolean(selectedProject),
    ),
  )
  const ptaRows = ptas.data?.data || emptyList.data
  const ptaOnPage = ptaRows.find((item) => item.id === search.pta)
  const selectedPtaQuery = useQuery(
    portalSelectionQuery({
      api,
      key: [user?.id, 'selected-pta', selectedProject?.id, search.pta],
      path: `/partner-portal/projects/${selectedProject?.id}/ptas`,
      id: search.pta,
      firstPage: cursors.ptaCursor ? undefined : ptas.data,
      onDenied: deny,
      enabled: Boolean(
        permitted && selectedProject && search.pta && ptas.data && !ptaOnPage,
      ),
    }),
  )
  const selectedPta = search.pta
    ? ptaOnPage || selectedPtaQuery.data
    : ptaRows[0]
  const activities = useQuery(
    portalQuery(
      api,
      [user?.id, 'activities', selectedPta?.id, cursors.activityCursor],
      `ptas/${selectedPta?.id}/activities?${new URLSearchParams({
        limit: '60',
        ...(cursors.activityCursor ? { cursor: cursors.activityCursor } : {}),
      })}`,
      deny,
      permitted && Boolean(selectedPta) && screen !== 'exports',
    ),
  )
  const activityRows = activities.data?.data || emptyList.data
  const activityOnPage = activityRows.find(
    (activity) => activity.id === search.activity,
  )
  const selectedActivityQuery = useQuery(
    portalSelectionQuery({
      api,
      key: [user?.id, 'selected-activity', selectedPta?.id, search.activity],
      path: `/partner-portal/ptas/${selectedPta?.id}/activities`,
      id: search.activity,
      firstPage: cursors.activityCursor ? undefined : activities.data,
      onDenied: deny,
      enabled: Boolean(
        permitted &&
        selectedPta &&
        search.activity &&
        activities.data &&
        !activityOnPage &&
        screen !== 'exports',
      ),
    }),
  )
  const selectedActivityId =
    activityOnPage?.id || selectedActivityQuery.data?.id || ''
  const detail = useQuery(
    portalQuery(
      api,
      [user?.id, 'detail', selectedActivityId],
      `activities/${selectedActivityId}`,
      deny,
      permitted && Boolean(selectedActivityId) && screen !== 'exports',
    ),
  )
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
      deliverBlobDownload({ blob, filename })
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
  const selectionQueries = [
    selectedProjectQuery,
    selectedPtaQuery,
    selectedActivityQuery,
  ]
  const selectionIssue =
    selectionQueries.find((query) => query.isError) ||
    (projects.isSuccess &&
    search.project &&
    !selectedProject &&
    selectedProjectQuery.isSuccess
      ? selectedProjectQuery
      : null) ||
    (ptas.isSuccess && search.pta && !selectedPta && selectedPtaQuery.isSuccess
      ? selectedPtaQuery
      : null) ||
    (activities.isSuccess &&
    search.activity &&
    !selectedActivityId &&
    selectedActivityQuery.isSuccess
      ? selectedActivityQuery
      : null)
  const changeSearch = (values) => {
    downloadGuard.revoke()
    const hierarchyChanged = Object.keys(values).some((key) =>
      [
        'activity',
        'project',
        'pta',
        'activityCursor',
        'ptaCursor',
        'projectCursor',
      ].includes(key),
    )
    const cursorValues = Object.fromEntries(
      Object.entries(values).filter(([key]) => key.endsWith('Cursor')),
    )
    if (Object.keys(cursorValues).length || hierarchyChanged)
      setCursors((current) => ({
        ...current,
        ...(hierarchyChanged ? { documentCursor: '' } : {}),
        ...cursorValues,
      }))
    const routeValues = Object.fromEntries(
      Object.entries(values).filter(([key]) => !key.endsWith('Cursor')),
    )
    return navigate({
      to: screen === 'exports' ? Urls.partnerExports : Urls.partner,
      search: {
        ...search,
        ...routeValues,
      },
    })
  }
  if (primaryQueries.some((query) => query.isError) || selectionIssue)
    return (
      <RetryableError
        page
        onRetry={() =>
          void Promise.all(
            [...primaryQueries, ...selectionQueries]
              .filter(
                (query) =>
                  query.isError ||
                  query === selectionIssue ||
                  query.data == null,
              )
              .map((query) => query.refetch()),
          )
        }
      >
        {strings.portfolioUnavailable}
      </RetryableError>
    )
  if (
    primaryQueries.some((query) => query.isPending) ||
    (search.project && !projectOnPage && selectedProjectQuery.isFetching)
  )
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
                      activity: '',
                      ptaCursor: '',
                      activityCursor: '',
                    })
                  }
                >
                  {selectedProject &&
                    !projectRows.some(
                      (row) => row.id === selectedProject.id,
                    ) && (
                      <option value={selectedProject.id}>
                        {selectedProject.name}
                      </option>
                    )}
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
                      void changeSearch({
                        pta: event.target.value,
                        activity: '',
                        activityCursor: '',
                      })
                    }
                  >
                    {selectedPta &&
                      !ptaRows.some((row) => row.id === selectedPta.id) && (
                        <option value={selectedPta.id}>
                          {selectedPta.year}
                        </option>
                      )}
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
              path="/partner-portal/projects"
              change={(projectCursor) =>
                changeSearch({
                  projectCursor,
                  project: '',
                  pta: '',
                  ptaCursor: '',
                })
              }
            />
            {ptas.isPending ||
            (search.pta && !ptaOnPage && selectedPtaQuery.isFetching) ? (
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
                        to={Urls.partner}
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
              path={`/partner-portal/projects/${selectedProject.id}/ptas`}
              change={(ptaCursor) => changeSearch({ ptaCursor, pta: '' })}
            />
          </>
        )}
      </section>
    )
  return (
    <section className="grid gap-6 [&_[data-ui~='planning-list']_li]:flex [&_[data-ui~='planning-list']_li]:justify-between [&_[data-ui~='planning-list']_li]:gap-6 [&_[data-ui~='planning-list']_div]:grid [&_[data-ui~='planning-list']_div]:gap-1 [&_[data-ui~='planning-list']_small]:text-muted-foreground [&_[data-ui~='planning-list']_span]:text-muted-foreground">
      <Helmet>
        <title>{strings.pageTitle}</title>
      </Helmet>
      <header
        className="flex justify-between items-center gap-5 flex-wrap [&_h1]:text-navy [&_h1]:font-semibold [&_h1]:text-[1.75rem] [&_nav]:flex [&_nav]:gap-5 max-[641px]:items-start"
        data-ui="planning-heading"
      >
        <div>
          <p className="mt-0 mr-0 mb-[6px] ml-0 text-primary text-[0.8125rem] font-semibold uppercase tracking-[0.04em]">
            {strings.overview}
          </p>
          <h1>
            {strings.formatString(strings.greeting, {
              name:
                !profile.isError && profile.data?.name
                  ? profile.data.name
                  : strings.defaultPartnerName,
            })}
          </h1>
          <p>{strings.overviewHelp}</p>
        </div>
        <span className="border border-border rounded-full py-[7px] px-3 bg-white text-muted-foreground text-[0.8125rem]">
          {strings.readOnly}
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
                <h2>{strings.myProjects}</h2>
                <p>
                  {strings.formatString(strings.portfolioProjects, {
                    count: projectRows.length,
                  })}
                </p>
              </div>
              {projectRows.length > 1 && (
                <label>
                  {strings.displayedProject}
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
                    {selectedProject &&
                      !projectRows.some(
                        (project) => project.id === selectedProject.id,
                      ) && (
                        <option value={selectedProject.id}>
                          {selectedProject.name}
                        </option>
                      )}
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
                <dt>{strings.reference}</dt>
                <dd>{selectedProject.reference}</dd>
              </div>
              <div>
                <dt>{strings.projectLabel}</dt>
                <dd>{selectedProject.name}</dd>
              </div>
              <div>
                <dt>{strings.state}</dt>
                <dd>
                  {selectedProject.state === 'closed'
                    ? strings.closedMasculine
                    : strings.activeMasculine}
                </dd>
              </div>
            </dl>
            <PortalPagination
              page={projects.data}
              label={strings.projectsPagination}
              path="/partner-portal/projects"
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
          ) : ptas.isPending ||
            (search.pta && !ptaOnPage && selectedPtaQuery.isFetching) ? (
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
                  <Button
                    type="button"
                    variant="outline"
                    disabled={csvExport.isPending}
                    loading={csvExport.isPending}
                    onClick={() => csvExport.mutate(selectedPta.id)}
                  >
                    {csvExport.isPending
                      ? strings.partnerPtaCsvPending
                      : strings.partnerPtaCsv}
                  </Button>
                  {csvExport.isError &&
                    csvExport.error?.name !== 'AbortError' && (
                      <p role="alert">{strings.partnerPtaCsvFailed}</p>
                    )}
                  <p>
                    {strings.formatString(strings.closedActivitiesSummary, {
                      closed: selectedPta.metrics.physical.closed_activities,
                      approved:
                        selectedPta.metrics.physical.approved_activities,
                    })}
                  </p>
                </div>
                {ptaRows.length > 1 && (
                  <label>
                    {strings.year}
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
                      {selectedPta &&
                        !ptaRows.some((pta) => pta.id === selectedPta.id) && (
                          <option value={selectedPta.id}>
                            {selectedPta.year}
                          </option>
                        )}
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
                path={`/partner-portal/projects/${selectedProject.id}/ptas`}
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
                  <h3>{strings.physicalProgress}</h3>
                  <strong>
                    {selectedPta.metrics.physical.closed_activities} /{' '}
                    {selectedPta.metrics.physical.approved_activities}
                  </strong>
                  <p>{strings.closedAndApprovedActivities}</p>
                </article>
                <article>
                  <h3>{strings.financialExecution}</h3>
                  <strong>
                    {formatXof(selectedPta.metrics.financial.closed_spending)}
                  </strong>
                  <p>
                    {strings.formatString(strings.approvedAmountSummary, {
                      amount: formatXof(
                        selectedPta.metrics.financial.approved_allocation,
                      ),
                    })}
                  </p>
                </article>
              </div>
              <h3>{strings.approvedActivitiesTitle}</h3>
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
                          {strings.formatString(strings.activityPeriod, {
                            reference: activity.reference,
                            start: activity.planned_start,
                            end: activity.planned_end,
                          })}
                        </small>
                      </div>
                      <span>
                        {activity.state === 'closed'
                          ? strings.closedFeminine
                          : strings.approvedFeminine}{' '}
                        · {formatXof(activity.allocation)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void changeSearch({ activity: activity.id })
                        }
                      >
                        {strings.viewDetail}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyContent kind="execution" large />
              )}
              <PortalPagination
                page={activities.data}
                label={strings.activitiesLabel}
                path={`/partner-portal/ptas/${selectedPta.id}/activities`}
                change={(activityCursor) =>
                  changeSearch({ activityCursor, activity: '' })
                }
              />
            </Panel>
          ) : (
            <Panel as="article">
              <h2>{strings.noPta}</h2>
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
                    {strings.approvedActivity}
                  </p>
                  <h2 id="partner-detail">{detail.data.name}</h2>
                  <p>{detail.data.description}</p>
                </div>
                <ProtectedFilePreview
                  key={detail.data.id}
                  path={`/api/v1/partner-portal/activities/${detail.data.id}/fiche.pdf`}
                  title={strings.activityFicheTitle}
                  kind="pdf"
                  onDenied={(status) =>
                    deny(status, [
                      'partner-portal',
                      user.id,
                      'detail',
                      detail.data.id,
                    ])
                  }
                  scope={ficheScope}
                >
                  {strings.consultPdf}
                </ProtectedFilePreview>
              </div>
              <dl className="flex gap-8 flex-wrap [&_dt]:text-muted-foreground [&_dt]:text-[0.8125rem]">
                <div>
                  <dt>{strings.reference}</dt>
                  <dd>{detail.data.reference}</dd>
                </div>
                <div>
                  <dt>{strings.period}</dt>
                  <dd>
                    {strings.formatString(strings.periodValue, {
                      start: formatDate(detail.data.planned_start),
                      end: formatDate(detail.data.planned_end),
                    })}
                  </dd>
                </div>
                <div>
                  <dt>{strings.approvedBudget}</dt>
                  <dd>{formatXof(detail.data.allocation)}</dd>
                </div>
                <div>
                  <dt>{strings.progress}</dt>
                  <dd>
                    {detail.data.progress == null
                      ? strings.unavailable
                      : `${detail.data.progress} %`}
                  </dd>
                </div>
              </dl>
              <h3>{strings.approvedTasks}</h3>
              <ul
                className="grid gap-0 p-0 list-none [&_li]:min-h-13 [&_li]:border-t [&_li]:border-t-border [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4"
                data-ui="planning-list"
              >
                {detail.data.tasks.map((task, index) => (
                  <li key={`${task.name}-${index}`}>
                    <div>
                      <strong>{task.name}</strong>
                      <small>{task.description}</small>
                      {task.subtasks?.length ? (
                        <small>
                          {task.subtasks
                            .map((subtask) =>
                              subtask.progress == null
                                ? subtask.name
                                : `${subtask.name} (${subtask.progress} %)`,
                            )
                            .join(' · ')}
                        </small>
                      ) : null}
                    </div>
                    <span>
                      {task.final_spending == null
                        ? formatXof(task.allocation)
                        : strings.formatString(strings.spentAmount, {
                            amount: formatXof(task.final_spending),
                          })}
                      {task.progress != null && ` · ${task.progress} %`}
                    </span>
                  </li>
                ))}
              </ul>
              <h3>{strings.finalDecisions}</h3>
              <ul
                className="grid gap-0 p-0 list-none [&_li]:min-h-13 [&_li]:border-t [&_li]:border-t-border [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4"
                data-ui="planning-list"
              >
                {detail.data.decisions.map((decision) => (
                  <li key={`${decision.kind}-${decision.revision}`}>
                    <strong>
                      {decision.kind === 'initial'
                        ? strings.approvedPlanning
                        : decision.kind === 'amendment'
                          ? strings.approvedAmendment
                          : strings.approvedTransfer}
                    </strong>
                    <span>{formatDate(decision.decided_at)}</span>
                  </li>
                ))}
              </ul>
              <PartnerDocuments
                key={`${user.id}:${detail.data.id}`}
                activityId={detail.data.id}
                userId={user.id}
                cursor={cursors.documentCursor}
                changeCursor={(documentCursor) =>
                  changeSearch({ documentCursor })
                }
                onDenied={deny}
              />
              <h3>{strings.financialResult}</h3>
              {detail.data.finance ? (
                <dl className="flex gap-8 flex-wrap [&_dt]:text-muted-foreground [&_dt]:text-[0.8125rem]">
                  <div>
                    <dt>{strings.finalSpending}</dt>
                    <dd>{formatXof(detail.data.finance.final_spending)}</dd>
                  </div>
                  {detail.data.finance.zero_spending && (
                    <div>
                      <dt>{strings.validatedPath}</dt>
                      <dd>{strings.validatedZeroSpending}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{strings.confirmedTransfer}</dt>
                    <dd>
                      {detail.data.finance.confirmed_transfer_amount == null
                        ? strings.noTransferRequired
                        : `${formatXof(
                            detail.data.finance.confirmed_transfer_amount,
                          )} · ${formatDate(
                            detail.data.finance.confirmed_transfer_date,
                          )}`}
                    </dd>
                  </div>
                  <div>
                    <dt>{strings.surplusToReturn}</dt>
                    <dd>
                      {formatXof(detail.data.finance.reversement_required)}
                    </dd>
                  </div>
                  <div>
                    <dt>{strings.returnedSurplus}</dt>
                    <dd>
                      {detail.data.finance.reversement_amount == null
                        ? strings.noReturnRequired
                        : `${formatXof(
                            detail.data.finance.reversement_amount,
                          )} · ${formatDate(
                            detail.data.finance.reversement_date,
                          )}`}
                    </dd>
                  </div>
                  <div>
                    <dt>{strings.closure}</dt>
                    <dd>{formatDate(detail.data.finance.closed_at)}</dd>
                  </div>
                </dl>
              ) : (
                <p>{strings.financeAfterClosure}</p>
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
