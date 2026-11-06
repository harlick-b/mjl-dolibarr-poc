import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAPI } from '@/shared/api/RestClientProvider'
import { useAccess } from '@/features/auth/access-verification'
import { Select } from '@/shared/ui/select'
import { Button } from '@/shared/ui/button'
import { cursorFrom } from '@/shared/lib/pagination'
import { strings } from '@/locales/fr/ListFilters'
import { strings as common } from '@/locales/fr/common'

export function QueryFilterSelect({
  kind,
  path = '/audit-events/filter-options',
  value = '',
  onChange,
}) {
  const { api } = useAPI()
  const { user } = useAccess()
  const scope = `${path}:${kind}`
  const [previousScope, setPreviousScope] = useState(scope)
  const [cursor, setCursor] = useState('')
  if (previousScope !== scope) {
    setPreviousScope(scope)
    setCursor('')
  }
  const query = useQuery({
    queryKey: ['filter-options', user.id, path, kind, cursor],
    queryFn: ({ signal }) =>
      api.request(
        `/api/v1${path}?${new URLSearchParams({ ...(path === '/audit-events/filter-options' ? { kind } : {}), ...(cursor ? { cursor } : {}) })}`,
        { signal },
      ),
  })
  return (
    <div className="grid gap-2">
      <label>
        {strings[kind]}
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
      </label>
      {query.isError && (
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          {strings.unavailable} · {common.retry}
        </Button>
      )}
      {(query.data?.next || query.data?.previous) && (
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
      )}
    </div>
  )
}
