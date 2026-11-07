import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useAPI } from '@/shared/api/RestClientProvider'
import { useAccess } from '@/features/auth/access-verification'
import { AccessDeniedState } from '@/features/auth/AccessDeniedState'
import { Button } from '@/shared/ui/button'
import { PTAModal } from './PTAModal'
import { strings as metadata } from '@/locales/fr/PTAModal'
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
  const { user, can } = useAccess()
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
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
        {can('ptaManagement') && (
          <Button className="justify-self-end" onClick={() => setOpen(true)}>
            <Plus size={16} />
            {metadata.create}
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
                  metadata.activities,
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
                  className="border-b border-border align-top last:border-0"
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
                      {row.project_state === 'closed'
                        ? ` · ${metadata.closed}`
                        : ''}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold">{row.year}</p>
                    <p className="mt-1 font-medium">{row.name}</p>
                    {row.description && (
                      <p className="mt-1 max-w-80 text-xs text-muted-foreground">
                        {row.description}
                      </p>
                    )}
                  </td>
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
      {open && (
        <PTAModal
          onDenied={() => setDenied(true)}
          onClose={() => setOpen(false)}
          onSaved={(pta) =>
            navigate({
              to: '/projects/$projectId/ptas/$year',
              params: { projectId: pta.project_id, year: String(pta.year) },
            })
          }
        />
      )}
    </div>
  )
}
