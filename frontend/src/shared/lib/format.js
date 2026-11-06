export function addThreeMonths(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const targetMonth = month + 3
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = targetMonth % 12
  const lastDay = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0),
  ).getUTCDate()
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

export function formatXof(value) {
  const amount = typeof value === 'bigint' ? value : BigInt(value || 0)
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} XOF`
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date)
}
import { strings } from '@/locales/fr/format'

export function formatPercentage(numerator, denominator) {
  const total = BigInt(denominator)
  if (total === 0n) return strings.notCalculable
  const tenths = (BigInt(numerator) * 1000n + total / 2n) / total
  const whole = tenths / 10n
  const decimal = tenths % 10n
  return `${whole}${decimal ? `,${decimal}` : ''} %`
}
