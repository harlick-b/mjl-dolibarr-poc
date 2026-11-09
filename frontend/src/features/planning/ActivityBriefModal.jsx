import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown } from 'lucide-react'
import { useAPI } from '@/shared/api/RestClientProvider'
import { useSessionQuery } from '@/features/auth/SessionProvider'
import { sessionKey } from '@/features/auth/auth'
import { Modal } from '@/shared/ui/BusinessModal'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Panel } from '@/shared/ui/layout'
import { Button } from '@/shared/ui/button'
import { DatePicker } from '@/shared/ui/DatePicker'
import { RetryableError } from '@/shared/ui/RetryableError'
import { cursorFrom } from '@/shared/lib/pagination'
import { strings } from '@/locales/fr/ActivityBriefModal'

export function ActivityBriefModal({
  context,
  open = true,
  opener,
  onClose,
  onSaved,
  onDenied,
}) {
  const { api } = useAPI()
  const session = useSessionQuery().data
  const client = useQueryClient()
  const [base] = useState(context)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [selected, setSelected] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const unknownOutcome = useRef(false)
  const submitted = useRef(null)
  const [requestKey] = useState(() => crypto.randomUUID())
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q.trim())
      setCursor('')
    }, 250)
    return () => clearTimeout(timer)
  }, [q])
  const sameSession = () =>
    client.getQueryData(sessionKey)?.csrf === session.csrf &&
    client.getQueryData(sessionKey)?.user?.id === session.user.id
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['planning', session.user.id] }),
      client.invalidateQueries({ queryKey: ['audit-history'] }),
    ])
  const agents = useQuery({
    queryKey: ['planning', session.user.id, 'brief-agents', search, cursor],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(
          `/api/v1/assignment-agents?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(cursor ? { cursor } : {}) })}`,
          { signal },
        )
      } catch (error) {
        if ([403, 404].includes(error.status) && active.current) {
          onClose()
          onDenied?.()
          client.removeQueries({ queryKey: ['planning', session.user.id] })
        }
        throw error
      }
    },
    enabled: open && expanded,
  })
  const save = useMutation({
    retry: false,
    meta: { localError: true },
    mutationFn: () => {
      // An unknown response must be retried with the exact original command.
      submitted.current ??= {
        request_key: requestKey,
        name: name.trim(),
        description: description.trim(),
        planned_start: start,
        planned_end: end || null,
        agent_ids: selected.map((agent) => agent.id),
      }
      return api.request(
        `/api/v1/projects/${base.project.id}/ptas/${base.year}/activities`,
        { method: 'POST', csrf: session.csrf, body: submitted.current },
      )
    },
    onSuccess: async (result) => {
      if (!sameSession()) return
      await refresh()
      if (active.current && sameSession()) onSaved(result)
    },
    onError: async (error) => {
      if (error.name === 'AbortError' || !sameSession()) return
      const outcomeUnknown =
        ['network', 'malformed'].includes(error.kind) || error.status >= 500
      const conclusiveRetry =
        unknownOutcome.current && error.code === 'assignment_ineligible'
      if (
        active.current &&
        (outcomeUnknown || (unknownOutcome.current && !conclusiveRetry))
      ) {
        unknownOutcome.current = true
        setUncertain(true)
      } else if (active.current) {
        unknownOutcome.current = false
        setUncertain(false)
        submitted.current = null
      }
      await refresh()
    },
  })
  const dismiss = () => {
    onClose(save.isPending || uncertain)
    setTimeout(() => opener?.current?.focus(), 0)
  }
  return (
    <Modal open={open} onClose={dismiss} label={strings.title} opener={opener}>
      <Panel
        as={BusinessForm}
        className="gap-6 rounded-none border-0 [&_textarea]:min-h-18"
        onSubmit={() => save.mutateAsync()}
      >
        <fieldset disabled={uncertain} className="contents">
          <p className="text-xs text-muted-foreground">
            PTA {base.year} · {base.pta.name}
          </p>
          <label>
            {strings.name}
            <input
              autoFocus
              required
              maxLength={200}
              placeholder={strings.namePlaceholder}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            {strings.description}
            <span className="text-xs font-normal text-muted-foreground">
              {strings.optional}
            </span>
            <textarea
              rows={2}
              maxLength={4000}
              placeholder={strings.descriptionPlaceholder}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-3 text-sm">
              <span>{strings.start}</span>
              <DatePicker
                label={strings.start}
                value={start}
                onChange={setStart}
                min={`${base.year}-01-01`}
                max={`${base.year}-12-31`}
              />
            </div>
            <div className="grid gap-3 text-sm">
              <span>
                {strings.end}{' '}
                <small className="text-muted-foreground">
                  {strings.optional}
                </small>
              </span>
              <DatePicker
                label={strings.end}
                value={end}
                onChange={setEnd}
                min={start || `${base.year}-01-01`}
                optional
              />
            </div>
          </div>
          <div className="grid gap-3 text-sm">
            <span>{strings.agents}</span>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <span className="truncate">
                {selected.length
                  ? selected
                      .map((agent) => agent.full_name || agent.email)
                      .join(', ')
                  : strings.chooseAgents}
              </span>
              <ChevronDown size={16} />
            </Button>
            {expanded && (
              <div className="rounded-control border border-border p-2">
                <input
                  aria-label={strings.search}
                  placeholder={strings.search}
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
                {agents.isError ? (
                  <RetryableError onRetry={() => agents.refetch()}>
                    {strings.unavailable}
                  </RetryableError>
                ) : (
                  <div
                    role="listbox"
                    aria-label={strings.agents}
                    aria-multiselectable="true"
                    aria-busy={agents.isFetching}
                    className="mt-1 max-h-48 overflow-auto"
                    onKeyDown={(event) => {
                      if (
                        !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(
                          event.key,
                        )
                      )
                        return
                      event.preventDefault()
                      const options = [
                        ...event.currentTarget.querySelectorAll(
                          '[role=option]',
                        ),
                      ]
                      const index = options.indexOf(document.activeElement)
                      const next =
                        event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? options.length - 1
                            : (index +
                                (event.key === 'ArrowDown' ? 1 : -1) +
                                options.length) %
                              options.length
                      options[next]?.focus()
                    }}
                  >
                    {agents.data?.data.map((agent) => {
                      const checked = selected.some(
                        (row) => row.id === agent.id,
                      )
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={checked}
                          key={agent.id}
                          className={`flex min-h-10 w-full items-center justify-between rounded-control px-3 text-left text-sm hover:bg-selected ${checked ? 'bg-selected' : ''}`}
                          onClick={() =>
                            setSelected(
                              checked
                                ? selected.filter((row) => row.id !== agent.id)
                                : [...selected, agent],
                            )
                          }
                        >
                          {agent.full_name || agent.email}
                          {checked && <Check size={15} />}
                        </button>
                      )
                    })}
                    {agents.isSuccess && !agents.data.count && (
                      <p className="p-3 text-center text-muted-foreground">
                        {strings.none}
                      </p>
                    )}
                  </div>
                )}
                {(agents.data?.next || agents.data?.previous) && (
                  <div className="mt-2 flex justify-end gap-2">
                    {['previous', 'next'].map((direction) => (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        key={direction}
                        disabled={!agents.data[direction] || agents.isFetching}
                        onClick={() =>
                          setCursor(
                            cursorFrom(
                              agents.data[direction],
                              '/assignment-agents',
                            ),
                          )
                        }
                      >
                        {strings[direction]}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="-mt-2 text-xs text-muted-foreground">
              {strings.assignmentHelp}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{strings.help}</p>
        </fieldset>
        {save.isError && save.error.name !== 'AbortError' && (
          <p role="alert" className="text-sm text-destructive">
            {save.error.code === 'assignment_ineligible'
              ? strings.assignmentError
              : ['network', 'malformed'].includes(save.error.kind) ||
                  save.error.status >= 500
                ? strings.uncertain
                : strings.error}
          </p>
        )}
        <div data-ui="modal-actions">
          <Button type="button" variant="outline" onClick={dismiss}>
            {strings.cancel}
          </Button>
          <Button
            disabled={
              !name.trim() ||
              !start ||
              (end && end < start) ||
              !selected.length ||
              selected.length > 100
            }
          >
            {uncertain ? strings.retry : strings.save}
          </Button>
        </div>
      </Panel>
    </Modal>
  )
}
