import { ListFilters } from '@/shared/ui/ListFilters'
import { Select } from '@/shared/ui/select'
import { Link } from '@tanstack/react-router'
import { Button } from '@/shared/ui/button'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { formatDate, formatXof } from '@/shared/lib/format'
import { strings } from '@/locales/fr/PlanningView'

export function PlanningActivities({
  result,
  year,
  view,
  onView,
  filters,
  onFilter,
}) {
  const rows = result?.data || []
  return (
    <section className="overflow-hidden rounded-panel border border-border bg-white">
      <ListFilters
        value={filters?.q || ''}
        label={strings.searchActivities}
        onSearch={(q) => onFilter({ q })}
        active={Boolean(filters?.state)}
        onReset={() => onFilter({ q: '', state: '' })}
      >
        <label>
          {strings.validation}
          <Select
            value={filters?.state || ''}
            onChange={(event) => onFilter({ state: event.target.value })}
          >
            <option value="">{strings.allStates}</option>
            {[
              'draft',
              'amendment_draft',
              'submitted',
              'prevalidated',
              'returned_supervisor',
              'returned_validator',
              'approved',
              'withdrawn',
              'closed',
            ].map((state) => (
              <option key={state} value={state}>
                {strings[state]}
              </option>
            ))}
          </Select>
        </label>
      </ListFilters>
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
        <div className="grid gap-4 p-5 md:grid-cols-3">
          {Array.from({ length: 12 }, (_, month) => {
            const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
            const end = `${year}-${String(month + 1).padStart(2, '0')}-31`
            const matches = rows.filter(
              (row) => row.planned_start <= end && row.planned_end >= start,
            )
            return (
              <section
                key={month}
                className="overflow-hidden rounded-card border border-border"
              >
                <h3 className="flex justify-between bg-background px-3 py-3 text-sm font-semibold capitalize">
                  {new Intl.DateTimeFormat('fr-FR', {
                    month: 'long',
                    timeZone: 'UTC',
                  }).format(new Date(Date.UTC(year, month, 1)))}
                  <span className="text-xs font-normal text-muted-foreground">
                    {matches.length}
                  </span>
                </h3>
                {matches.length ? (
                  matches.map((row) => (
                    <div
                      key={row.id}
                      className="border-t border-border p-3 text-[0.8125rem]"
                    >
                      <Link
                        className="font-medium text-primary"
                        to="/activities/$activityId"
                        params={{ activityId: row.id }}
                      >
                        {row.name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(row.planned_start)} –{' '}
                        {formatDate(row.planned_end)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="p-3 text-xs text-muted-foreground">
                    {strings.emptyMonth}
                  </p>
                )}
              </section>
            )
          })}
          {(result?.next || result?.previous) && (
            <p className="text-xs text-muted-foreground md:col-span-3">
              {strings.calendarPage}
            </p>
          )}
        </div>
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
                ].map((label, i) => (
                  <th key={i} className="px-3 py-3 font-medium">
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
                      kind={
                        filters?.q || filters?.state ? 'search' : 'activities'
                      }
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
