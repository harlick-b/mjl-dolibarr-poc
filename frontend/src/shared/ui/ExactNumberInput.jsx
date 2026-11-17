import { useState } from 'react'
import { cn } from '@/shared/lib/utils'

function format(value, scale) {
  if (!value) return ''
  const [whole, fraction] = value.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  return scale && fraction !== undefined ? `${grouped},${fraction}` : grouped
}

function normalize(value, scale) {
  const compact = value.replace(/[\s\u202f]/g, '').replace(',', '.')
  const expression = scale
    ? new RegExp(`^\\d*(?:\\.\\d{0,${scale}})?$`)
    : /^\d*$/
  return expression.test(compact) ? compact : null
}

export function ExactNumberInput({
  value,
  onChange,
  name,
  scale = 0,
  suffix,
  className,
  ...props
}) {
  const [focused, setFocused] = useState(false)
  const raw = value === null || value === undefined ? '' : String(value)
  return (
    <span className={cn('relative block', className)}>
      {name && <input type="hidden" name={name} value={raw} />}
      <input
        {...props}
        value={focused ? raw : format(raw, scale)}
        inputMode={scale ? 'decimal' : 'numeric'}
        onFocus={(event) => {
          setFocused(true)
          props.onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          props.onBlur?.(event)
        }}
        onChange={(event) => {
          const next = normalize(event.target.value, scale)
          if (next !== null) onChange(next)
        }}
        className={cn(suffix && 'pr-16')}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </span>
  )
}
