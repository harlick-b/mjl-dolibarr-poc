import { formatDate, formatDateTime, formatXof } from '@/shared/lib/format'
import { strings } from '@/locales/fr/AuditHistoryView'

const dateFields = new Set([
  'Début prévu',
  'Fin prévue',
  'Date effective',
  'Date du virement',
  'Date du reversement',
])

export const hasAuditValue = (value) =>
  value !== null && value !== undefined && value !== ''

function formatValue(value, field, matchesDateField) {
  if (!value) return '—'
  if (field.includes('(F CFA)') && /^-?[0-9]+$/.test(value))
    return formatXof(value)
  if (matchesDateField(field) && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return formatDate(value)
  if (field === 'Début de réalisation') return formatDateTime(value)
  return value
}

export function formatAuditValue(value, field) {
  return formatValue(value, field, (candidate) => dateFields.has(candidate))
}

export function formatActivityAuditValue(value, field) {
  return formatValue(value, field, (candidate) =>
    [...dateFields].some((dateField) => candidate.endsWith(dateField)),
  )
}

export function activityFieldLabel(field) {
  const label = field
    .replace(/^Tâche indisponible · /, `${strings.unidentifiedTask} · `)
    .replace(/^Sous-tâche indisponible · /, `${strings.unidentifiedSubtask} · `)
    .replaceAll(' · ', ', ')
    .replace(/Poids \(%\)$/, 'Pondération (%)')
    .replace(/ \(F CFA\)$/, '')
  if (/^Tâche .+, Nom$/.test(label)) return strings.taskTitle
  if (/^Sous-tâche .+, Nom$/.test(label)) return strings.subtaskTitle
  return label
}

const initialRecordActions = new Set([
  'operation.execution_recorded',
  'subtask.execution_recorded',
  'virement_confirmation.declared',
  'reversement.declared',
])

function activityDetailLabel(action, field) {
  const label = activityFieldLabel(field)
  if (
    action.startsWith('virement_confirmation.') &&
    field === 'Date du virement'
  )
    return strings.effectiveTransferDate
  if (field === 'Dépenses (F CFA)') return strings.recordedSpending
  if (field !== 'Montant (F CFA)') return label
  if (action.endsWith('.approved')) return strings.authorizedAmount
  if (action.startsWith('virement_confirmation.'))
    return strings.transferredAmount
  if (action.startsWith('reversement.')) return strings.returnedAmount
  if (
    action.startsWith('operation.execution_') ||
    action.startsWith('subtask.execution_')
  )
    return strings.recordedSpending
  if (
    ['funding.', 'disbursement.', 'virement.'].some((prefix) =>
      action.startsWith(prefix),
    )
  )
    return strings.requestedAmount
  return label
}

const entryKey = (entry) =>
  `${entry.label}\u0000${formatActivityAuditValue(entry.after, entry.field)}`

function directEntry(action, item) {
  return {
    ...item,
    label: activityDetailLabel(action, item.field),
  }
}

function deduplicateDirectEntries(action, facts, changes) {
  const directChanges = changes
    .filter((change) => hasAuditValue(change.after))
    .map((change) => directEntry(action, change))
  const directFacts = facts.map((fact) => directEntry(action, fact))
  const entries = [...directChanges]
  const seen = new Set(entries.map(entryKey))

  for (const fact of directFacts) {
    if (
      action === 'reversement.declared' &&
      fact.field === 'Reversement requis (F CFA)' &&
      entries.some(
        (entry) =>
          entry.label === strings.returnedAmount && entry.after === fact.after,
      )
    )
      continue
    if (!seen.has(entryKey(fact))) {
      entries.push(fact)
      seen.add(entryKey(fact))
    }
  }
  return entries
}

export function activityEventPresentation(event) {
  const facts = activityEventFacts(event)
  const changes = activityEventChanges(event)
  const isInitialRecord = initialRecordActions.has(event.action)
  const comparisons = isInitialRecord
    ? []
    : changes
        .filter((change) => hasAuditValue(change.before))
        .map((change) => ({
          ...directEntry(event.action, change),
          removed: !hasAuditValue(change.after),
        }))
  const oneSidedChanges = isInitialRecord
    ? changes
    : changes.filter((change) => !hasAuditValue(change.before))
  const comparisonKeys = new Set(comparisons.map(entryKey))
  const relevantFacts = facts.filter(
    (fact) =>
      !(
        (event.action.startsWith('operation.execution_') ||
          event.action.startsWith('subtask.execution_')) &&
        fact.field === 'Budget approuvé (F CFA)'
      ),
  )
  const direct = deduplicateDirectEntries(
    event.action,
    relevantFacts,
    oneSidedChanges,
  ).filter((entry) => !comparisonKeys.has(entryKey(entry)))

  return { direct, comparisons }
}

export function activityEventChanges(event) {
  return (event.changes || []).filter(
    (change) =>
      change.field !== 'État' &&
      (hasAuditValue(change.before) || hasAuditValue(change.after)),
  )
}

export function activityEventFacts(event) {
  return (event.facts || []).filter((fact) => hasAuditValue(fact.after))
}

export function activityRegisterEvents(events) {
  return events.filter(
    (event) =>
      event.action !== 'activity.replace' ||
      activityEventChanges(event).length > 0,
  )
}
