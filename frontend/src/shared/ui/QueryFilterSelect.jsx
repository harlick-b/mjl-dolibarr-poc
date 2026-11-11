import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAPI } from '@/shared/api/RestClientProvider'
import { useAccess } from '@/features/auth/session/access-verification'
import { Select } from '@/shared/ui/select'
import { Button } from '@/shared/ui/button'
import { cursorFrom } from '@/shared/lib/pagination'
import { strings } from '@/locales/fr/ListFilters'
import { strings as common } from '@/locales/fr/common'
import * as Popover from '@radix-ui/react-popover'

export function QueryFilterSelect({
  kind,
  path = '/audit-events/filter-options',
  value = '',
  valueLabel = '',
  onChange,
  onDenied,
  onResolvedLabel,
  searchable = false,
  compact = false,
}) {
  const { api } = useAPI()
  const { user } = useAccess()
  const scope = `${path}:${kind}`
  const [previousScope, setPreviousScope] = useState(scope)
  const [cursor, setCursor] = useState('')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (!searchable || draft === search) return
    const timer = setTimeout(() => {
      setSearch(draft)
      setCursor('')
    }, 250)
    return () => clearTimeout(timer)
  }, [draft, search, searchable])
  if (previousScope !== scope) {
    setPreviousScope(scope)
    setCursor('')
  }
  const query = useQuery({
    queryKey: ['filter-options', user.id, path, kind, search, cursor],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(
          `/api/v1${path}?${new URLSearchParams({ ...(path === '/audit-events/filter-options' ? { kind } : {}), ...(searchable && search ? { q: search } : {}), ...(cursor ? { cursor } : {}) })}`,
          { signal },
        )
      } catch (error) {
        if ([401, 403, 404].includes(error.status)) onDenied?.(error)
        throw error
      }
    },
  })
  const selectedQuery = useQuery({
    queryKey: ['filter-option', user.id, path, kind, value],
    queryFn: ({ signal }) =>
      api.request(
        `/api/v1${path}?${new URLSearchParams({ limit: '1', selected: value })}`,
        { signal },
      ),
    enabled: searchable && Boolean(value),
  })
  const selected =
    query.data?.data.find((row) => row.id === value) ||
    selectedQuery.data?.data.find((row) => row.id === value)
  useEffect(() => {
    onResolvedLabel?.(value ? selected?.label || '' : '')
  }, [onResolvedLabel, selected?.label, value])
  const pagination = (query.data?.next || query.data?.previous) && (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={!query.data.previous}
        onClick={() => setCursor(cursorFrom(query.data.previous, path))}
      >
        {common.previous}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={!query.data.next}
        onClick={() => setCursor(cursorFrom(query.data.next, path))}
      >
        {common.next}
      </Button>
    </div>
  )
  return (
    <div className="grid gap-2">
      <label>
        <span className={compact ? 'sr-only' : undefined}>{strings[kind]}</span>
        {searchable ? (
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={query.isPending || query.isError}
                className="w-full justify-between font-normal"
                aria-label={
                  compact ? `${strings[kind]} · ${value ? 1 : 0}` : undefined
                }
              >
                {compact
                  ? `${strings[kind]} · ${value ? 1 : 0}`
                  : selected?.label ||
                    valueLabel ||
                    (value ? strings[kind] : strings.all)}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                sideOffset={6}
                className="z-50 grid w-72 gap-2 rounded-card border border-border bg-white p-3 shadow-lg"
              >
                <input
                  type="search"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Rechercher un ${strings[kind]}…`}
                  maxLength={200}
                  autoFocus
                />
                <div
                  className="grid max-h-52 gap-1 overflow-y-auto"
                  role="listbox"
                >
                  <Popover.Close asChild>
                    <button
                      type="button"
                      role="option"
                      aria-selected={!value}
                      className="rounded-control px-3 py-2 text-left hover:bg-selected aria-selected:bg-selected"
                      onClick={() => onChange('', '')}
                    >
                      {strings.all}
                    </button>
                  </Popover.Close>
                  {query.data?.data.map((row) => (
                    <Popover.Close asChild key={row.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={value === row.id}
                        className="rounded-control px-3 py-2 text-left hover:bg-selected aria-selected:bg-selected"
                        onClick={() => onChange(row.id, row.label)}
                      >
                        {row.label}
                      </button>
                    </Popover.Close>
                  ))}
                </div>
                {pagination}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : (
          <Select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={query.isPending || query.isError}
          >
            <option value="">{strings.all}</option>
            {value && !query.data?.data.some((row) => row.id === value) && (
              <option value={value}>{strings[kind]}</option>
            )}
            {query.data?.data.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </Select>
        )}
      </label>
      {query.isError && (
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          {strings.unavailable} · {common.retry}
        </Button>
      )}
      {!searchable && pagination}
    </div>
  )
}
