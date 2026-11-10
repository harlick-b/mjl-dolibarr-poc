import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAPI } from '@/shared/api/RestClientProvider'
import { useSessionQuery } from '@/features/auth/SessionProvider'
import { sessionKey } from '@/features/auth/auth'
import { Modal } from '@/shared/ui/BusinessModal'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Panel } from '@/shared/ui/layout'
import { Button } from '@/shared/ui/button'
import { Select } from '@/shared/ui/select'
import { RetryableError } from '@/shared/ui/RetryableError'
import { cursorFrom } from '@/shared/lib/pagination'
import { strings } from '@/locales/fr/PTAModal'
import { toast } from 'sonner'

// Mounted only while open: an edit owns a snapshot and its optimistic version.
export function PTAModal({
  pta: initialPTA,
  project: initialProject,
  opener,
  onClose,
  onSaved,
  onDenied,
}) {
  const [pta] = useState(initialPTA)
  const [project] = useState(initialProject)
  const { api } = useAPI()
  const session = useSessionQuery().data
  const client = useQueryClient()
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const [name, setName] = useState(pta?.name ?? '')
  const [description, setDescription] = useState(pta?.description ?? '')
  const [year, setYear] = useState(
    String(pta?.year ?? new Date().getFullYear()),
  )
  const [selected, setSelected] = useState(project ?? null)
  const [cursor, setCursor] = useState('')
  const [mustReopen, setMustReopen] = useState(false)
  const projects = useQuery({
    queryKey: ['planning', session.user.id, 'pta-project-options', cursor],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(
          `/api/v1/projects?state=active${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`,
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
    enabled: !pta,
  })
  const options =
    projects.data?.data.filter((item) => item.state === 'active') ?? []
  // Keep the first visible choice stable if other records arrive during editing.
  if (!selected && options.length) setSelected(options[0])
  const current = selected
  const sameSession = () => {
    const currentSession = client.getQueryData(sessionKey)
    return (
      currentSession?.state === 'verified' &&
      currentSession.user.id === session.user.id &&
      currentSession.csrf === session.csrf
    )
  }
  const refreshSaved = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['planning', session.user.id] }),
      client.invalidateQueries({ queryKey: ['audit-history'] }),
    ])
  const save = useMutation({
    retry: false,
    meta: { localError: true },
    mutationFn: async () => {
      return api.request(
        pta ? `/api/v1/ptas/${pta.id}` : `/api/v1/projects/${current.id}/ptas`,
        {
          method: pta ? 'PATCH' : 'POST',
          csrf: session.csrf,
          body: {
            name: name.trim(),
            description: description.trim() || null,
            ...(pta
              ? { expected_version: pta.version }
              : { year: Number(year) }),
          },
        },
      )
    },
    onSuccess: async (result) => {
      if (!sameSession()) return
      await refreshSaved()
      if (active.current && sameSession()) {
        toast.success(pta ? strings.updated : strings.created)
        await onSaved(result)
      }
    },
    onError: async (error) => {
      if (error.name === 'AbortError' || !sameSession()) return
      if (!active.current) {
        await refreshSaved()
        return
      }
      if (
        ['network', 'malformed'].includes(error.kind) ||
        error.status >= 500
      ) {
        // A lost response is not proof of rollback. Read the actual resource
        // before enabling another command; optimistic version/uniqueness still guard it.
        setMustReopen(true)
        try {
          const projectId = pta?.project_id ?? current.id
          const actual = await client.fetchQuery({
            queryKey: [
              'planning',
              session.user.id,
              'pta',
              projectId,
              Number(year),
            ],
            staleTime: 0,
            queryFn: ({ signal }) =>
              api.request(`/api/v1/projects/${projectId}/ptas/${year}`, {
                signal,
              }),
          })
          if (!sameSession()) return
          if (!active.current) {
            await refreshSaved()
            return
          }
          if (!actual || !Object.hasOwn(actual, 'pta')) return
          if (
            actual.pta?.name === name.trim() &&
            (actual.pta.description ?? '') === description.trim() &&
            (!pta || actual.pta.version > pta.version)
          ) {
            await Promise.all([
              client.invalidateQueries({
                queryKey: ['planning', session.user.id],
              }),
              client.invalidateQueries({ queryKey: ['audit-history'] }),
            ])
            if (active.current) {
              toast.success(pta ? strings.updated : strings.created)
              await onSaved(actual.pta)
            }
            return
          }
          setMustReopen(
            Boolean(actual.pta && (!pta || actual.pta.version !== pta.version)),
          )
        } catch (readError) {
          if ([403, 404].includes(readError.status) && active.current) {
            onClose()
            onDenied?.()
            client.removeQueries({ queryKey: ['planning', session.user.id] })
          }
        }
      }
      if (active.current)
        await client.invalidateQueries({
          queryKey: ['planning', session.user.id],
        })
    },
  })
  return (
    <Modal
      open
      onClose={onClose}
      label={pta ? strings.edit : strings.create}
      opener={opener}
    >
      <Panel
        as={BusinessForm}
        className="rounded-none border-0 [&_textarea]:min-h-22"
        onSubmit={() => save.mutateAsync()}
      >
        {pta ? (
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                {strings.project}
              </p>
              <p>{project.name}</p>
            </div>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                {strings.year}
              </p>
              <p>{pta.year}</p>
            </div>
          </div>
        ) : (
          <>
            <label className="gap-0 text-sm font-normal">
              {strings.project} *
              <Select
                required
                value={current?.id ?? ''}
                disabled={projects.isPending || projects.isError}
                onChange={(event) =>
                  setSelected(
                    options.find((item) => item.id === event.target.value),
                  )
                }
              >
                <option value="">{strings.chooseProject}</option>
                {current && !options.some((item) => item.id === current.id) && (
                  <option value={current.id}>{current.name}</option>
                )}
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            {projects.isSuccess && projects.data.count === 0 && (
              <p className="text-sm text-muted-foreground">
                {strings.noProjects}
              </p>
            )}
            {projects.isError && (
              <RetryableError onRetry={() => projects.refetch()}>
                {strings.unavailable}
              </RetryableError>
            )}
            {(projects.data?.next || projects.data?.previous) && (
              <div className="flex justify-end gap-2">
                {['previous', 'next'].map((direction) => (
                  <Button
                    type="button"
                    variant="outline"
                    key={direction}
                    disabled={!projects.data[direction]}
                    onClick={() => {
                      setSelected(current)
                      setCursor(
                        cursorFrom(projects.data[direction], '/projects'),
                      )
                    }}
                  >
                    {strings[direction]}
                  </Button>
                ))}
              </div>
            )}
            <label className="gap-0 text-sm font-normal">
              {strings.year} *
              <Select
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                {Array.from({ length: 13 }, (_, index) =>
                  String(new Date().getFullYear() - 2 + index),
                ).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </label>
          </>
        )}
        <label className="gap-4">
          {strings.name} *
          <input
            required
            autoFocus
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="gap-4">
          {strings.description}
          <textarea
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {save.isError && save.error.name !== 'AbortError' && (
          <p role="alert" className="text-sm text-destructive">
            {['network', 'malformed'].includes(save.error.kind) ||
            save.error.status >= 500
              ? strings.uncertain
              : save.error.status === 403
                ? strings.forbidden
                : save.error.code === 'pta_exists'
                  ? strings.duplicate
                  : save.error.code === 'pta_stale'
                    ? strings.stale
                    : save.error.code === 'project_closed'
                      ? strings.projectClosed
                      : strings.failed}
          </p>
        )}
        <div data-ui="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {strings.cancel}
          </Button>
          <Button
            type="submit"
            disabled={
              mustReopen ||
              !name.trim() ||
              (!pta && (!current || projects.isError || projects.isPending)) ||
              save.error?.code === 'pta_stale'
            }
          >
            {pta ? strings.save : strings.createSubmit}
          </Button>
        </div>
      </Panel>
    </Modal>
  )
}
