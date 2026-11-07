import { PlanningIndex } from '@/features/planning/PlanningIndex'
import { ExecutionList } from '@/features/execution/ExecutionView'
import { Select } from '@/shared/ui/select'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { ArrowRight } from 'lucide-react'
import { useAccess } from '@/features/auth/access-verification'
import { useAPI } from '@/shared/api/RestClientProvider'
import { Panel } from '@/shared/ui/layout'
import { Button } from '@/shared/ui/button'
import { PageLoading, RefreshIndicator } from '@/shared/ui/PageLoading'
import { RetryableError } from '@/shared/ui/RetryableError'
import { formatPercentage } from '@/shared/lib/format'
import { cursorFrom } from '@/shared/lib/pagination'
import { strings } from '@/locales/fr/WorkspaceOverview'

export function WorkspaceOverview({ screen = 'dashboard' }) {
  const policy = useAccess()
  const title = strings[screen]
  return (
    <section className="grid gap-6">
      <Helmet>
        <title>{`${title} — MJL`}</title>
      </Helmet>
      {!policy.can('accounts') && screen !== 'planning' && (
        <h1 className="text-2xl font-semibold text-navy">{title}</h1>
      )}
      {policy.can('business') ? (
        screen === 'planning' ? (
          <PlanningIndex />
        ) : (
          <BusinessOverview screen={screen} user={policy.user} />
        )
      ) : policy.can('accounts') ? (
        <AdminOverview user={policy.user} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {policy.can('accounts')
              ? strings.adminDescription
              : strings.partnerDescription}
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {policy.navigation
              .filter((page) => page.id !== 'dashboard')
              .map((page) => (
                <Link
                  key={page.id}
                  to={page.path}
                  className="flex min-h-28 items-center justify-between gap-4 rounded-panel border border-border bg-white p-6 font-semibold text-navy hover:border-primary"
                >
                  {page.label}
                  <ArrowRight size={20} aria-hidden="true" />
                </Link>
              ))}
          </div>
        </>
      )}
    </section>
  )
}
function AdminOverview({ user }) {
  const { api } = useAPI()
  const counts = useQuery({
    queryKey: ['access', user.id, 'dashboard'],
    queryFn: async ({ signal }) => {
      const [active, pending] = await Promise.all(
        ['active', 'pending'].map((state) =>
          api.request(`/api/v1/access/users?state=${state}&page=1&size=1`, {
            signal,
          }),
        ),
      )
      return { active: active.total, pending: pending.total }
    },
  })
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-navy">
          {strings.administration}
        </h1>
        <Button asChild>
          <Link to="/access/users" search={{ invite: true }}>
            {strings.invite}
          </Link>
        </Button>
      </div>
      {counts.isPending ? (
        <PageLoading title={strings.administration} />
      ) : counts.isError ? (
        <RetryableError onRetry={() => counts.refetch()}>
          {strings.unavailable}
        </RetryableError>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel className="p-0 gap-0 flex flex-col [&>h2]:border-b [&>h2]:border-border [&>h2]:px-5 [&>h2]:py-4 [&>strong]:px-5 [&>strong]:pt-5 [&>p]:px-5 [&>p]:py-4 [&>a]:mx-5 [&>a]:mb-5 [&>a]:mt-auto [&>a]:self-start">
            <h2>{strings.accountsTitle}</h2>
            <strong className="text-3xl text-navy">{counts.data.active}</strong>
            <p className="text-sm text-muted-foreground">
              {strings.activeAccounts}
            </p>
            <Button variant="outline" asChild>
              <Link to="/access/users">{strings.manageUsers}</Link>
            </Button>
          </Panel>
          <Panel className="p-0 gap-0 flex flex-col [&>h2]:border-b [&>h2]:border-border [&>h2]:px-5 [&>h2]:py-4 [&>strong]:px-5 [&>strong]:pt-5 [&>p]:px-5 [&>p]:py-4 [&>a]:mx-5 [&>a]:mb-5 [&>a]:mt-auto [&>a]:self-start">
            <h2>{strings.invitations}</h2>
            <strong className="text-3xl text-navy">
              {counts.data.pending}
            </strong>
            <p className="text-sm text-muted-foreground">
              {strings.pendingAccounts}
            </p>
            <Button variant="outline" asChild>
              <Link to="/access/users" search={{ state: 'pending' }}>
                {strings.viewAccounts}
              </Link>
            </Button>
          </Panel>
          <Panel className="p-0 gap-0 flex flex-col [&>h2]:border-b [&>h2]:border-border [&>h2]:px-5 [&>h2]:py-4 [&>strong]:px-5 [&>strong]:pt-5 [&>p]:px-5 [&>p]:py-4 [&>a]:mx-5 [&>a]:mb-5 [&>a]:mt-auto [&>a]:self-start">
            <h2>{strings.traceability}</h2>
            <p className="text-sm text-muted-foreground">
              {strings.auditDescription}
            </p>
            <Button className="self-end" variant="outline" asChild>
              <Link to="/history">{strings.viewHistory}</Link>
            </Button>
          </Panel>
        </div>
      )}
    </>
  )
}
function BusinessOverview({ screen, user }) {
  const { api } = useAPI()
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const projectCursor = search.projectCursor || ''
  const ptaCursor = search.ptaCursor || ''
  const selectedProject = search.project || ''
  const selectedPta = search.pta || ''
  const change = (values) =>
    void navigate({ to: `/${screen}`, search: { ...search, ...values } })
  const projects = useQuery({
    queryKey: ['planning', user.id, 'projects', projectCursor],
    queryFn: ({ signal }) =>
      api.request(
        `/api/v1/projects${projectCursor ? `?cursor=${encodeURIComponent(projectCursor)}` : ''}`,
        { signal },
      ),
  })
  const project =
    projects.data?.data.find((p) => p.id === selectedProject) ||
    projects.data?.data[0]
  const ptas = useQuery({
    queryKey: ['planning', user.id, 'ptas', project?.id, ptaCursor],
    queryFn: ({ signal }) =>
      api.request(
        `/api/v1/projects/${project.id}/ptas${ptaCursor ? `?cursor=${encodeURIComponent(ptaCursor)}` : ''}`,
        { signal },
      ),
    enabled: Boolean(project),
  })
  const pta =
    ptas.data?.data.find((p) => p.id === selectedPta) || ptas.data?.data[0]
  const metrics = useQuery({
    queryKey: ['planning', user.id, 'pta-metrics', pta?.id],
    queryFn: ({ signal }) =>
      api.request(`/api/v1/ptas/${pta.id}/metrics`, { signal }),
    enabled: screen === 'dashboard' && Boolean(pta),
  })
  const executionFilters = Object.fromEntries(
    ['q', 'state', 'agent']
      .filter((key) => search[key])
      .map((key) => [key, search[key]]),
  )
  const executionFilterKey = new URLSearchParams(executionFilters).toString()
  const execution = useQuery({
    placeholderData: (previous, query) =>
      query?.queryKey[1] === user.id && query?.queryKey[3] === pta?.id
        ? previous
        : undefined,
    queryKey: [
      'execution',
      user.id,
      'list',
      pta?.id,
      search.cursor || '',
      executionFilterKey,
    ],
    queryFn: ({ signal }) =>
      api.request(
        `/api/v1/ptas/${pta.id}/execution${executionFilterKey || search.cursor ? '?' + new URLSearchParams({ ...executionFilters, ...(search.cursor ? { cursor: search.cursor } : {}) }) : ''}`,
        { signal },
      ),
    enabled: screen === 'execution' && Boolean(pta),
  })
  if (projects.isPending) return <PageLoading title={strings[screen]} />
  if (projects.isError)
    return (
      <RetryableError onRetry={() => void projects.refetch()}>
        {strings.unavailable}
      </RetryableError>
    )
  if (!project)
    return screen === 'dashboard' ? (
      <EmptyDashboard />
    ) : (
      <>
        <Panel className="flex flex-wrap items-end gap-4 border-0 bg-transparent p-0">
          <label className="w-full max-w-120">
            {strings.project}
            <Select disabled value="">
              <option value="">{strings.selectProject}</option>
            </Select>
          </label>
          <label>
            {strings.pta}
            <Select disabled value="">
              <option value="">{strings.selectPta}</option>
            </Select>
          </label>
        </Panel>
        <ExecutionList embedded result={{ data: [], count: 0 }} />
      </>
    )
  return (
    <>
      <Panel className="flex flex-wrap items-end gap-4 border-0 bg-transparent p-0">
        <label className="w-full max-w-120">
          {strings.project}
          <Select
            value={project.id}
            onChange={(event) => {
              change({
                project: event.target.value,
                ptaCursor: '',
                pta: '',
                cursor: '',
              })
            }}
          >
            {projects.data.data.map((row) => (
              <option key={row.id} value={row.id}>
                {row.reference} — {row.name}
              </option>
            ))}
          </Select>
        </label>
        {screen === 'execution' && (
          <>
            {' '}
            <label className="max-w-40">
              {strings.pta}
              <Select
                value={pta?.id || ''}
                disabled={!pta}
                onChange={(event) =>
                  change({ pta: event.target.value, cursor: '' })
                }
              >
                {!pta && <option value="">{strings.selectPta}</option>}
                {ptas.data?.data.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.year}
                  </option>
                ))}
              </Select>
            </label>
            <p className="pb-3 text-sm text-primary">
              {project.partner_name || ''}
            </p>
          </>
        )}
        <CursorButtons
          result={projects.data}
          busy={projects.isFetching}
          path="/projects"
          onMove={(cursor) => {
            change({
              projectCursor: cursor,
              project: '',
              ptaCursor: '',
              pta: '',
            })
          }}
        />
      </Panel>
      {ptas.isPending ? (
        <PageLoading title={strings.planning} className="min-h-48" />
      ) : ptas.isError ? (
        <RetryableError onRetry={() => void ptas.refetch()}>
          {strings.unavailable}
        </RetryableError>
      ) : !pta ? (
        screen === 'dashboard' ? (
          <EmptyDashboard />
        ) : (
          <ExecutionList embedded result={{ data: [], count: 0 }} />
        )
      ) : (
        <>
          {screen === 'execution' ? (
            <>
              {execution.isPending ? (
                <PageLoading title={strings.execution} />
              ) : execution.isError ? (
                <RetryableError onRetry={() => execution.refetch()}>
                  {strings.unavailable}
                </RetryableError>
              ) : (
                <ExecutionList
                  embedded
                  result={execution.data}
                  ptaId={pta.id}
                  filters={executionFilters}
                  onFilterChange={(values) => change({ ...values, cursor: '' })}
                  onPage={(link) =>
                    change({
                      cursor: cursorFrom(link, `/ptas/${pta.id}/execution`),
                    })
                  }
                />
              )}
            </>
          ) : (
            <>
              <Panel>
                <label className="max-w-xs">
                  {strings.pta}
                  <Select
                    value={pta.id}
                    onChange={(event) => change({ pta: event.target.value })}
                  >
                    {ptas.data.data.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.year}
                      </option>
                    ))}
                  </Select>
                </label>
              </Panel>
              {metrics.isPending ? (
                <PageLoading title={strings.dashboard} className="min-h-48" />
              ) : metrics.isError ? (
                <RetryableError onRetry={() => void metrics.refetch()}>
                  {strings.unavailable}
                </RetryableError>
              ) : (
                <div
                  className="grid gap-6 md:grid-cols-2"
                  aria-busy={metrics.isFetching}
                >
                  <Metric
                    title={strings.physical}
                    rate={dashboardPercentage(
                      metrics.data.physical.closed_activities,
                      metrics.data.physical.approved_activities,
                    )}
                    basis={strings.physicalBasis}
                    value={`${metrics.data.physical.closed_activities} / ${metrics.data.physical.approved_activities}`}
                  />
                  <Metric
                    title={strings.financial}
                    rate={dashboardPercentage(
                      metrics.data.financial.closed_spending,
                      metrics.data.financial.approved_allocation,
                    )}
                    basis={strings.financialBasis}
                    value={`${new Intl.NumberFormat('fr-FR').format(BigInt(metrics.data.financial.closed_spending)) + ' F CFA'} / ${new Intl.NumberFormat('fr-FR').format(BigInt(metrics.data.financial.approved_allocation)) + ' F CFA'}`}
                  />
                </div>
              )}
            </>
          )}
          <RefreshIndicator active={ptas.isFetching} />
          <CursorButtons
            result={ptas.data}
            busy={ptas.isFetching}
            path={`/projects/${project.id}/ptas`}
            onMove={(cursor) => {
              change({ ptaCursor: cursor, pta: '' })
            }}
          />
        </>
      )}
    </>
  )
}
function Metric({ title, rate, basis, value }) {
  return (
    <Panel>
      <h2>{title}</h2>
      <strong className="text-3xl font-semibold text-navy">{rate}</strong>
      <div className="text-sm">
        <p className="text-muted-foreground">{basis}</p>
        <p className="mt-2 font-medium">{value}</p>
      </div>
    </Panel>
  )
}

function dashboardPercentage(value, total) {
  return String(total) === '0' ? '0 %' : formatPercentage(value, total)
}
function CursorButtons({ result, path, onMove, busy }) {
  if (!result?.previous && !result?.next) return null
  return (
    <nav aria-label={strings.projects} className="flex justify-end gap-2">
      <Button
        variant="outline"
        disabled={busy || !result.previous}
        onClick={() => onMove(cursorFrom(result.previous, path))}
      >
        {strings.previous}
      </Button>
      <Button
        variant="outline"
        disabled={busy || !result.next}
        onClick={() => onMove(cursorFrom(result.next, path))}
      >
        {strings.next}
      </Button>
    </nav>
  )
}

function EmptyDashboard() {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <Metric
          title={strings.physical}
          rate="0 %"
          basis={strings.emptyPhysical}
        />
        <Metric
          title={strings.financial}
          rate="0 %"
          basis={strings.emptyFinancial}
        />
      </div>
      <Panel className="p-0 gap-0">
        <h2 className="border-b border-border p-5">{strings.attention}</h2>
        <EmptyContent kind="actions" />
      </Panel>
      <Panel className="p-0 gap-0">
        <h2 className="border-b border-border p-5">{strings.financeTitle}</h2>
        <dl className="grid gap-6 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [strings.approvedBudget, '0 F CFA'],
            [strings.recordedSpending, strings.notEntered],
            [strings.closedSpending, '0 F CFA'],
            [strings.returnDue, strings.notEntered],
            [strings.returnConfirmed, strings.notConfirmed],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[0.8125rem] text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-2 text-base font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  )
}
