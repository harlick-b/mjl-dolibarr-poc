import { useEffect, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Button } from './button'
import { strings } from '@/locales/fr/ListFilters'

export function ListFilters({
  value = '',
  onSearch,
  label,
  children,
  active = false,
  onReset,
  disabled = false,
  toolbar,
}) {
  const [expanded, setExpanded] = useState(active)
  const [draft, setDraft] = useState(value)
  const [previousValue, setPreviousValue] = useState(value)
  if (previousValue !== value) {
    setPreviousValue(value)
    setDraft(value)
  }
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onSearch(draft), 350)
    return () => clearTimeout(timer)
  }, [draft, value, onSearch])
  return (
    <div className="border-b border-border">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <label className="relative min-w-64 flex-1 max-w-140">
          <span className="sr-only">{label}</span>
          <Search
            size={16}
            className="absolute left-3 top-3 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={label}
            disabled={disabled}
            maxLength={200}
            className="h-10 w-full rounded-control border border-strong-border bg-white py-2 pl-10 pr-3 text-[0.8125rem] disabled:bg-background"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <Button
            type="button"
            variant="outline"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            disabled={disabled}
          >
            <SlidersHorizontal size={16} />
            {strings.filters}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="flex flex-wrap items-end gap-4 border-t border-border px-4 py-4 [&_label]:grid [&_label]:gap-2 [&_label]:text-[0.8125rem] [&_label]:min-w-40 [&_input]:rounded-control [&_input]:border [&_input]:border-strong-border [&_input]:px-3 [&_input]:py-2">
          {children}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft('')
              onReset()
            }}
          >
            {strings.reset}
          </Button>
        </div>
      )}
    </div>
  )
}
