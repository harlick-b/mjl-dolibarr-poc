import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { strings } from '@/locales/fr/PlanningView'
import { formatDate } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { Modal } from '@/shared/ui/BusinessModal'
import { timelinePosition, timelineWindow } from '../lib/timeline'
import { activityLocation } from '@/shared/lib/activity-navigation'

function monthName(year, month, style = 'short') {
  return new Intl.DateTimeFormat('fr-FR', {
    month: style,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function activityCount(count) {
  return `${count} ${count > 1 ? strings.activitiesLabel : strings.activitySingular}`
}

function formatTimelineDate(value) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

const TimelineActivityRow = ({
  row,
  position,
  year,
  month,
  gridColumns,
  gridTicks,
  monthlyTicks,
  lastRow,
  focusFallback,
}) => {
  const [tipOpen, setTipOpen] = useState(false)
  const [inspectionOpen, setInspectionOpen] = useState(false)
  const inspectionOpener = useRef(null)
  const inspectionOpenRef = useRef(false)
  const closeInspection = () => setInspectionOpen(false)

  useEffect(() => {
    inspectionOpenRef.current = inspectionOpen
  }, [inspectionOpen])

  useEffect(
    () => () => {
      if (inspectionOpenRef.current) focusFallback.current?.focus()
    },
    [focusFallback],
  )

  return (
    <>
      <div
        className={`grid min-h-16 grid-cols-[17rem_1fr] ${lastRow ? '' : 'border-b border-border'}`}
      >
        <div className="min-w-0 px-3 py-3">
          <Link
            className="block max-h-10 overflow-hidden text-sm font-medium leading-5 text-primary"
            {...activityLocation(row)}
          >
            {row.name}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">{row.reference}</p>
        </div>
        <div className="relative border-l border-border">
          <div
            aria-hidden="true"
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: gridColumns }}
          >
            {gridTicks.map((_, index) => (
              <span
                key={index}
                className={`${!month || monthlyTicks.has(index + 1) ? 'border-l border-border' : ''} first:border-l-0`}
              />
            ))}
          </div>
          <Button
            type="button"
            title={`${row.name} · ${formatDate(row.planned_start)}${row.planned_end ? ` – ${formatDate(row.planned_end)}` : ''}`}
            aria-label={`${row.name}, ${strings.fromDate} ${formatDate(row.planned_start)}${row.planned_end ? ` ${strings.toDate} ${formatDate(row.planned_end)}` : `, ${strings.startOnly.toLowerCase()}`}. ${strings.inspectTimeline}`}
            variant="unstyled"
            className={`absolute top-4 h-8 rounded-card bg-primary text-xs font-medium text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${position.marker ? 'min-w-4 rotate-45' : ''}`}
            style={{
              left: `${position.left}%`,
              width: `${position.width}%`,
            }}
            onMouseEnter={() => setTipOpen(true)}
            onMouseLeave={() => setTipOpen(false)}
            onFocus={() => setTipOpen(true)}
            onBlur={() => setTipOpen(false)}
            onClick={(event) => {
              inspectionOpener.current = event.currentTarget
              setInspectionOpen(true)
            }}
          >
            {!position.marker && (
              <span className="flex h-full items-center overflow-hidden whitespace-nowrap px-2">
                {position.before ? '‹ ' : ''}
                {formatTimelineDate(row.planned_start)} –{' '}
                {formatTimelineDate(row.planned_end)}
                {position.after ? ' ›' : ''}
              </span>
            )}
          </Button>
          {position.marker && (
            <span
              className="absolute top-12 -translate-x-1/2 text-[0.6875rem] text-muted-foreground"
              style={{ left: `${position.left}%` }}
            >
              {strings.startOnly}
            </span>
          )}
          {tipOpen && (
            <span
              role="tooltip"
              className="absolute left-2 top-13 z-10 grid max-w-72 gap-1 rounded-card bg-navy px-3 py-2 text-left text-xs text-white shadow-lg"
            >
              <strong>{row.name}</strong>
              <span>
                {formatDate(row.planned_start)}
                {row.planned_end
                  ? ` – ${formatDate(row.planned_end)}`
                  : ` · ${strings.startOnly}`}
              </span>
              <span>{row.agents?.join(', ') || strings.noAssignedAgent}</span>
            </span>
          )}
        </div>
      </div>
      {inspectionOpen && (
        <Modal
          open
          onClose={closeInspection}
          label={row.name || strings.activitySingular}
          opener={inspectionOpener}
        >
          <section className="grid gap-5 p-6">
            <p className="text-xs text-muted-foreground">
              {row.reference} · PTA {year}
            </p>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{strings.start}</dt>
                <dd>{formatDate(row.planned_start)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{strings.end}</dt>
                <dd>
                  {row.planned_end
                    ? formatDate(row.planned_end)
                    : strings.startOnly}
                </dd>
              </div>
            </dl>
            <p className="text-sm">
              <span className="block text-muted-foreground">
                {strings.assignedAgents}
              </span>
              {row.agents?.join(', ') || strings.noAssignedAgent}
            </p>
            <div data-ui="modal-actions">
              <Button type="button" variant="outline" onClick={closeInspection}>
                {strings.close}
              </Button>
              <Button asChild>
                <Link {...activityLocation(row)}>{strings.consult}</Link>
              </Button>
            </div>
          </section>
        </Modal>
      )}
    </>
  )
}

export function ActivityTimeline({ rows, year, month, onMonth, hasFilters }) {
  const focusFallback = useRef(null)
  const window = timelineWindow(year, month)
  const visible = rows
    .map((row) => ({ row, position: timelinePosition(row, window) }))
    .filter(({ position }) => position)
  const unscheduled = rows.filter((row) => !row.planned_start)
  const months = Array.from({ length: 12 }, (_, index) => ({
    label: monthName(year, index + 1),
    count: rows.filter((row) =>
      timelinePosition(row, timelineWindow(year, index + 1)),
    ).length,
  }))
  const days = month
    ? Array.from(
        { length: new Date(Date.UTC(year, month, 0)).getUTCDate() },
        (_, index) => index + 1,
      )
    : []
  const monthlyTicks = new Set(
    days.filter(
      (day) =>
        day === 1 ||
        day === days.length ||
        new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 1,
    ),
  )
  const annualColumns = Array.from({ length: 12 }, (_, index) =>
    new Date(Date.UTC(year, index + 1, 0)).getUTCDate(),
  )
  const gridColumns = month
    ? `repeat(${days.length}, minmax(0, 1fr))`
    : annualColumns.map((count) => `${count}fr`).join(' ')
  const gridTicks = month ? days : annualColumns

  return (
    <div className="p-5">
      {unscheduled.length > 0 && (
        <section className="mb-5 rounded-card border border-border bg-background p-4">
          <h3 className="font-semibold text-navy">{strings.unscheduled}</h3>
          <ul className="mt-2 grid gap-2">
            {unscheduled.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-3">
                <Link
                  className="text-sm font-medium text-primary"
                  {...activityLocation(row)}
                >
                  {row.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {row.reference}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p
          ref={focusFallback}
          tabIndex={-1}
          className="rounded-control font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <span className="capitalize">
            {month ? `${monthName(year, month, 'long')} ${year}` : year}
          </span>{' '}
          <small className="ml-2 font-normal text-muted-foreground">
            {activityCount(visible.length)}
          </small>
        </p>
        {month ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onMonth(undefined)}
            >
              {strings.annualView}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={month === 1}
              onClick={() => onMonth(month - 1)}
              aria-label={strings.previousMonth}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={month === 12}
              onClick={() => onMonth(month + 1)}
              aria-label={strings.nextMonth}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{strings.selectMonth}</p>
        )}
      </div>
      <div className="overflow-x-auto rounded-card border border-border">
        <div className="min-w-225">
          <div className="grid grid-cols-[17rem_1fr] border-b border-border bg-background text-xs text-muted-foreground">
            <div className="px-3 py-3 font-medium">
              {strings.activitySingular}
            </div>
            <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
              {month
                ? days.map((day) => (
                    <span
                      key={day}
                      className={`${monthlyTicks.has(day) ? 'border-l border-border' : ''} px-0.5 py-2 text-center`}
                    >
                      {monthlyTicks.has(day) && (
                        <>
                          <small className="block font-normal normal-case">
                            {new Intl.DateTimeFormat('fr-FR', {
                              weekday: 'short',
                              timeZone: 'UTC',
                            }).format(new Date(Date.UTC(year, month - 1, day)))}
                          </small>
                          {day}
                        </>
                      )}
                    </span>
                  ))
                : months.map(({ label, count }, index) => (
                    <Button
                      type="button"
                      key={label}
                      aria-label={label}
                      variant="unstyled"
                      className="border-l border-border px-1 py-2 capitalize hover:bg-selected hover:text-primary"
                      onClick={() => onMonth(index + 1)}
                    >
                      <span className="block font-medium">{label}</span>
                      <small className="font-normal normal-case">
                        {count ? activityCount(count) : '—'}
                      </small>
                    </Button>
                  ))}
            </div>
          </div>
          {!visible.length &&
            (month ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                {strings.noActivityThisMonth}
              </p>
            ) : (
              <EmptyContent kind={hasFilters ? 'search' : 'activities'} large />
            ))}
          {visible.map(({ row, position }, index) => (
            <TimelineActivityRow
              key={row.id}
              row={row}
              position={position}
              year={year}
              month={month}
              gridColumns={gridColumns}
              gridTicks={gridTicks}
              monthlyTicks={monthlyTicks}
              lastRow={index === visible.length - 1}
              focusFallback={focusFallback}
            />
          ))}
          <div className="flex flex-wrap gap-6 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <i className="h-2 w-5 rounded-sm bg-primary" />
              {strings.plannedPeriod}
            </span>
            <span>{`◆ ${strings.startOnly}`}</span>
            <span>{`‹ / › ${strings.outsidePeriod}`}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
