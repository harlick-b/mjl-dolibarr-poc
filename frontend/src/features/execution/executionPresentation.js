import { strings } from '@/locales/fr/ExecutionView'
import { formatXof } from '@/shared/lib/format'

export function countRecordedOperations(operations) {
  return operations.filter((operation) => operation.actual_spent !== null)
    .length
}

export function formatFinanceAmount(amount) {
  return amount === null ? strings.notProvided : formatXof(amount)
}
