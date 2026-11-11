import { strings } from '@/locales/fr/PlanningView'
import { formatXof } from '@/shared/lib/format'

export function PlanningSummary({ summary }) {
  if (!summary) return null
  return (
    <section
      aria-label={strings.planningSummary}
      className="flex flex-wrap items-center gap-6 rounded-panel border border-border bg-white px-5 py-4"
    >
      {[
        ['activities', strings.plannedActivities],
        ['approved', strings.approvedCount],
        ['review', strings.reviewCount],
        ['correction', strings.correctionCount],
        ['draft', strings.draftCount],
      ].map(([key, label]) => (
        <div key={key}>
          <strong className="text-xl font-semibold">{summary[key]}</strong>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
      <div className="ml-auto">
        <p className="text-xs text-muted-foreground">
          {strings.approvedBudget}
        </p>
        <strong className="mt-1 block">
          {formatXof(summary.approved_allocation)}
        </strong>
      </div>
    </section>
  )
}
