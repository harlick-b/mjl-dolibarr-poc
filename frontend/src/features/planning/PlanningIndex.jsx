import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useAPI } from '@/shared/api/RestClientProvider'
import { useAccess } from '@/features/auth/access-verification'
import { AccessDeniedState } from '@/features/auth/AccessDeniedState'
import { Button } from '@/shared/ui/button'
import { Panel } from '@/shared/ui/layout'
import { Select } from '@/shared/ui/select'
import { Modal } from '@/shared/ui/BusinessModal'
import { EmptyTable } from '@/shared/ui/EmptyContent'
import { PageLoading } from '@/shared/ui/PageLoading'
import { RetryableError } from '@/shared/ui/RetryableError'
import { formatXof } from '@/shared/lib/format'
import { cursorFrom } from '@/shared/lib/pagination'
import { strings } from '@/locales/fr/PlanningView'

export function PlanningIndex() {
  const { api } = useAPI()
  const client = useQueryClient()
  const [denied, setDenied] = useState(false)
  const read = async (path, signal) => {
    try {
      return await api.request(path, { signal })
    } catch (error) {
      if ([403, 404].includes(error.status)) {
        setDenied(true)
        setOpen(false)
        void client.cancelQueries({ queryKey: ['planning'] })
        client.removeQueries({ queryKey: ['planning'] })
      }
      throw error
    }
  }
  const { user } = useAccess()
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [projectId, setProjectId] = useState(search.project || '')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const path = search.project ? `/projects/${search.project}/ptas` : '/ptas'
  const ptas = useQuery({
    enabled: !denied,
    queryKey: [
      'planning',
      user.id,
      'pta-index',
      search.project,
      search.ptaCursor,
    ],
    queryFn: ({ signal }) =>
      read(
        `/api/v1${path}${search.ptaCursor ? '?cursor=' + encodeURIComponent(search.ptaCursor) : ''}`,
        signal,
      ),
  })
  const projects = useQuery({
    queryKey: ['planning', user.id, 'projects', search.projectCursor],
    queryFn: ({ signal }) =>
      read(
        `/api/v1/projects${search.projectCursor ? '?cursor=' + encodeURIComponent(search.projectCursor) : ''}`,
        signal,
      ),
    enabled: open && !denied,
  })
  const move = (link) =>
    navigate({
      to: '/planning',
      search: { ...search, ptaCursor: cursorFrom(link, path) },
    })
  if (denied) return <AccessDeniedState role={user.role} />
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-navy">
          {strings.planningIndex}
        </h1>
        {user.role === 'AGENT_SAISIE' && (
          <Button className="justify-self-end" onClick={() => setOpen(true)}>
            <Plus size={16} />
            {strings.addActivityToPta}
          </Button>
        )}
      </header>
      {search.project && (
        <Link to="/planning" className="text-sm text-primary">
          {strings.allPtas}
        </Link>
      )}
      {ptas.isPending ? (
        <PageLoading title={strings.annualPlan} />
      ) : ptas.isError ? (
        <RetryableError onRetry={() => ptas.refetch()}>
          {strings.unavailablePlanning}
        </RetryableError>
      ) : !ptas.data.data.length ? (
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
        <div className="overflow-x-auto rounded-panel border border-border bg-white">
          <table className="w-full min-w-190 text-left text-sm">
            <thead className="border-b border-border bg-background">
              <tr>
                {[
                  strings.projectPartner,
                  'PTA',
                  strings.activitiesLabel,
                  strings.validation,
                  strings.approvedBudget,
                  '',
                ].map((label, i) => (
                  <th className="px-3 py-3 font-medium" key={i}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ptas.data.data.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-3">
                    <Link
                      className="font-medium text-primary"
                      to="/projects/$projectId/ptas/$year"
                      params={{
                        projectId: row.project_id,
                        year: String(row.year),
                      }}
                    >
                      {row.project_name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.partner_name}
                    </p>
                  </td>
                  <td className="px-3 py-3 font-semibold">{row.year}</td>
                  <td className="px-3 py-3">
                    {row.summary?.activities ?? '—'}
                  </td>
                  <td className="px-3 py-3">
                    {row.summary ? (
                      <>
                        {row.summary.approved}{' '}
                        {strings.approvedCount.toLowerCase()}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.summary.review}{' '}
                          {strings.reviewCount.toLowerCase()} ·{' '}
                          {row.summary.correction}{' '}
                          {strings.correctionCount.toLowerCase()}
                        </p>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.summary
                      ? formatXof(row.summary.approved_allocation)
                      : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/projects/$projectId/ptas/$year"
                        params={{
                          projectId: row.project_id,
                          year: String(row.year),
                        }}
                      >
                        {strings.consultPta}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(ptas.data?.next || ptas.data?.previous) && (
        <nav className="flex justify-end gap-2" aria-label={strings.ptaPages}>
          <Button
            variant="outline"
            disabled={!ptas.data.previous}
            onClick={() => move(ptas.data.previous)}
          >
            {strings.previousPage}
          </Button>
          <Button
            variant="outline"
            disabled={!ptas.data.next}
            onClick={() => move(ptas.data.next)}
          >
            {strings.nextPage}
          </Button>
        </nav>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        label={strings.addActivityToPta}
      >
        <Panel className="border-0 p-6">
          {projects.isError && (
            <RetryableError onRetry={() => projects.refetch()}>
              {strings.unavailablePlanning}
            </RetryableError>
          )}
          <label>
            {strings.project}
            <Select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">{strings.chooseProject}</option>
              {projects.data?.data
                .filter((row) => row.state === 'active')
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </Select>
          </label>
          {(projects.data?.next || projects.data?.previous) && (
            <div className="flex gap-2">
              {['previous', 'next'].map((direction) => (
                <Button
                  key={direction}
                  variant="outline"
                  disabled={!projects.data[direction]}
                  onClick={() =>
                    navigate({
                      search: (current) => ({
                        ...current,
                        projectCursor: cursorFrom(
                          projects.data[direction],
                          '/projects',
                        ),
                      }),
                    })
                  }
                >
                  {direction === 'next'
                    ? strings.nextPage
                    : strings.previousPage}
                </Button>
              ))}
            </div>
          )}
          <label>
            {strings.year}
            <input
              type="number"
              min="2000"
              max="2200"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </label>
          <div data-ui="modal-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {strings.cancel}
            </Button>
            <Button
              disabled={
                !projectId ||
                !/^\d{4}$/.test(year) ||
                Number(year) < 2000 ||
                Number(year) > 2200
              }
              onClick={() =>
                navigate({
                  to: '/projects/$projectId/ptas/$year/activities/new',
                  params: { projectId, year },
                })
              }
            >
              {strings.continue}
            </Button>
          </div>
        </Panel>
      </Modal>
    </div>
  )
}
