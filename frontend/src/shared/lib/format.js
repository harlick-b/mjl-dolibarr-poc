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

export function localDateInput(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function formatXof(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return '—'
  if (typeof value === 'string' && !/^-?\d+$/.test(value)) return '—'
  if (
    typeof value !== 'bigint' &&
    typeof value !== 'string' &&
    typeof value !== 'number'
  )
    return '—'
  const amount = typeof value === 'bigint' ? value : BigInt(value)
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} F CFA`
}

export function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value || '')
  if (!match) return '—'
  if (String(value).length > 10 && Number.isNaN(Date.parse(value))) return '—'
  const calendarDay = `${match[1]}-${match[2]}-${match[3]}`
  const date = new Date(`${calendarDay}T00:00:00Z`)
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3])
  )
    return '—'
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

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Africa/Porto-Novo',
  }).format(date)
}
