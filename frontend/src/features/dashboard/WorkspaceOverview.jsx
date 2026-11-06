import { useState } from 'react'
import { EmptyContent, EmptyTable } from '@/shared/ui/EmptyContent'
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
        <title>{title} — MJL</title>
      </Helmet>
      <h1 className="text-2xl font-semibold text-navy">{title}</h1>
      {policy.can('business') ? (
        <BusinessOverview screen={screen} user={policy.user} />
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
function BusinessOverview({ screen, user }) {
  const { api } = useAPI()
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const projectCursor = search.projectCursor || ''
  const ptaCursor = search.ptaCursor || ''
  const selectedProject = search.project || ''
  const selectedPta = search.pta || ''
  const year = search.year || new Date().getFullYear()
  const [yearDraft, setYearDraft] = useState(null)
  const inputYear = yearDraft ?? String(year)
  const validYear =
    /^\d{4}$/.test(inputYear) &&
    Number(inputYear) >= 2000 &&
    Number(inputYear) <= 2200
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
    ) : screen === 'planning' ? (
      <EmptyTable
        kind="ptas"
        columns={[
          'projectPartner',
          'pta',
          'activitiesColumn',
          'validation',
          'budget',
        ]}
      />
    ) : (
      <Panel className="p-0">
        <EmptyContent
          kind={screen === 'execution' ? 'execution' : 'projects'}
        />
      </Panel>
    )
  return (
    <>
      <Panel className="gap-4 border-0 bg-transparent p-0">
        <label className="max-w-lg">
          {strings.project}
          <select
            value={project.id}
            onChange={(event) => {
              change({ project: event.target.value, ptaCursor: '', pta: '' })
            }}
          >
            {projects.data.data.map((row) => (
              <option key={row.id} value={row.id}>
                {row.reference} — {row.name}
              </option>
            ))}
          </select>
        </label>
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
      {screen === 'planning' && (
        <Panel className="border-0 bg-transparent p-0 flex flex-wrap items-end gap-3">
          <label>
            {strings.year}
            <input
              type="number"
              min="2000"
              max="2200"
              value={inputYear}
              onChange={(event) => setYearDraft(event.target.value)}
              onBlur={() => {
                if (validYear) {
                  change({ year: Number(inputYear) })
                  setYearDraft(null)
                }
              }}
            />
          </label>
          <Button
            variant="outline"
            disabled={!validYear}
            onClick={() =>
              void navigate({
                to: '/projects/$projectId/ptas/$year',
                params: { projectId: project.id, year: inputYear },
              })
            }
          >
            {strings.openYear}
          </Button>
        </Panel>
      )}
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
          <EmptyTable
            kind="ptas"
            columns={[
              'projectPartner',
              'pta',
              'activitiesColumn',
              'validation',
              'budget',
            ]}
          />
        )
      ) : (
        <>
          {screen === 'dashboard' ? (
            <>
              <Panel>
                <label className="max-w-xs">
                  {strings.pta}
                  <select
                    value={pta.id}
                    onChange={(event) => change({ pta: event.target.value })}
                  >
                    {ptas.data.data.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.year}
                      </option>
                    ))}
                  </select>
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
                    rate={formatPercentage(
                      metrics.data.physical.closed_activities,
                      metrics.data.physical.approved_activities,
                    )}
                    basis={strings.physicalBasis}
                    value={`${metrics.data.physical.closed_activities} / ${metrics.data.physical.approved_activities}`}
                  />
                  <Metric
                    title={strings.financial}
                    rate={formatPercentage(
                      metrics.data.financial.closed_spending,
                      metrics.data.financial.approved_allocation,
                    )}
                    basis={strings.financialBasis}
                    value={`${new Intl.NumberFormat('fr-FR').format(BigInt(metrics.data.financial.closed_spending)) + ' F CFA'} / ${new Intl.NumberFormat('fr-FR').format(BigInt(metrics.data.financial.approved_allocation)) + ' F CFA'}`}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="overflow-x-auto rounded-panel border border-border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-background text-muted-foreground">
                  <tr>
                    <th className="p-4 font-medium">{strings.project}</th>
                    <th className="p-4 font-medium">{strings.pta}</th>
                    <th className="p-4 font-medium">{strings.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {ptas.data.data.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="p-4">
                        <span className="block font-medium text-navy">
                          {project.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {project.reference}
                        </span>
                      </td>
                      <td className="p-4">{row.year}</td>
                      <td className="p-4">
                        <Button asChild variant="outline">
                          <Link
                            to={
                              screen === 'execution'
                                ? '/execution/$ptaId'
                                : '/projects/$projectId/ptas/$year'
                            }
                            params={{
                              ptaId: row.id,
                              projectId: project.id,
                              year: String(row.year),
                            }}
                          >
                            {strings.consult}
                            <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          rate={formatPercentage(0, 0)}
          basis={strings.emptyPhysical}
        />
        <Metric
          title={strings.financial}
          rate={formatPercentage(0, 0)}
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
