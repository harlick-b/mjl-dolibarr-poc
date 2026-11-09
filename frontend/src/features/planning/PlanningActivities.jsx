import { Link } from '@tanstack/react-router'
import { strings } from '@/locales/fr/PlanningView'
import { formatDate, formatXof } from '@/shared/lib/format'
import { ActivityExplorerFilters } from '@/shared/ui/ActivityExplorerFilters'
import { Button } from '@/shared/ui/button'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { ActivityTimeline } from './ActivityTimeline'

const stateOptions = [
  ['', strings.allStates],
  ['draft', strings.draft],
  ['amendment_draft', strings.amendment_draft],
  ['submitted', strings.submitted],
  ['prevalidated', strings.prevalidated],
  ['returned', strings.correctionCount],
  ['approved', strings.approved],
  ['withdrawn', strings.withdrawn],
  ['closed', strings.closed],
].map(([value, label]) => ({ value, label }))

const quickStates = [
  ['submitted', strings.awaitingPrevalidation],
  ['prevalidated', strings.awaitingFinalValidation],
  ['returned', strings.correctionCount],
].map(([value, label]) => ({ value, label }))

export function PlanningActivities({
  result,
  year,
  ptaId,
  month,
  view,
  onView,
  onMonth,
  filters,
  onFilter,
}) {
  const rows = result?.data || []
  const hasFilters = Boolean(
    filters?.q ||
    filters?.state ||
    filters?.agent ||
    filters?.from ||
    filters?.to,
  )
  return (
    <section className="overflow-hidden rounded-panel border border-border bg-white">
      <ActivityExplorerFilters
        value={filters}
        onChange={onFilter}
        agentPath={ptaId ? `/ptas/${ptaId}/activity-agents` : undefined}
        searchLabel={strings.searchActivities}
        stateLabel={strings.validation}
        stateOptions={stateOptions}
        quickStates={quickStates}
        dates
        disabled={!ptaId}
      />
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <span className="text-[0.8125rem]">
          {result?.count || 0}{' '}
          {(result?.count || 0) > 1
            ? strings.activitiesLabel
            : strings.activitySingular}
        </span>
        <div className="flex gap-2" aria-label={strings.displayMode}>
          {['table', 'calendar'].map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={view === mode}
              className="border-transparent bg-transparent aria-pressed:bg-selected aria-pressed:text-primary"
              onClick={() => onView(mode)}
            >
              {strings[mode]}
            </Button>
          ))}
        </div>
      </div>
      {view === 'calendar' ? (
        <ActivityTimeline
          rows={rows}
          year={year}
          month={month}
          onMonth={onMonth}
          hasFilters={hasFilters}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead className="border-b border-border bg-background">
              <tr>
                {[
                  strings.activityReference,
                  strings.period,
                  strings.budgetOperations,
                  strings.assignedAgents,
                  strings.validation,
                  '',
                ].map((label, index) => (
                  <th key={index} className="px-3 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr>
                  <td colSpan={6}>
                    <EmptyContent
                      kind={hasFilters ? 'search' : 'activities'}
                      large
                    />
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-3">
                    <Link
                      className="font-medium text-primary"
                      to="/activities/$activityId"
                      params={{ activityId: row.id }}
                    >
                      {row.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.reference}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {formatDate(row.planned_start)}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {strings.until} {formatDate(row.planned_end)}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {formatXof(row.allocation)}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.operation_count ?? '—'}{' '}
                      {row.operation_count > 1
                        ? strings.operationsLabel
                        : strings.operationSingular}
                    </p>
                  </td>
                  <td className="px-3 py-3">{row.agents?.join(', ') || '—'}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block rounded-card px-2 py-1 text-xs ${['approved', 'closed'].includes(row.state) ? 'bg-success-badge text-success' : row.state?.startsWith('returned') ? 'bg-warning-soft text-warning' : 'bg-selected text-primary'}`}
                    >
                      {strings[row.state] || '—'}
                    </span>
                    {row.revision_number && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {strings.revision} {row.revision_number}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/activities/$activityId"
                        params={{ activityId: row.id }}
                      >
                        {strings.consult}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
