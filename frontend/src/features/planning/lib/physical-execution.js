import { strings as executionStrings } from '@/locales/fr/ExecutionView'
import { formatExactPercentage } from '@/shared/lib/format'

export function physicalExecutionLabel(execution) {
  if (!execution) return '—'
  if (
    ['completed_pending_validation', 'validated'].includes(
      execution.realization_status,
    )
  )
    return executionStrings.completedLabel
  const state =
    executionStrings.realizationStates[execution.realization_status] ||
    execution.realization_status
  if (
    execution.progress === null ||
    execution.progress === undefined ||
    execution.realization_status === 'not_started' ||
    Number(execution.progress) === 0
  )
    return state
  return formatExactPercentage(execution.progress)
}
