import { formatDate, formatDateTime } from '@/shared/lib/format'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { Panel } from '@/shared/ui/layout'
import { useSessionQuery } from '@/features/auth/SessionProvider'
import { authorization } from '@/features/auth/authorization'
import { PageLoading, RefreshIndicator } from '@/shared/ui/PageLoading'
import { strings } from '@/locales/fr/NotificationView'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'
import { cursorFrom } from '@/shared/lib/pagination'
import { useAPI } from '@/shared/api/RestClientProvider'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/AccessDeniedState'

const notificationRoot = ['notifications']

export function NotificationView({ embedded = false, onSelect }) {
  const session = useSessionQuery()
  if (session.isPending) return <NotificationsLoading />
  if (!authorization(session.data).can('notifications'))
    return <AccessDeniedState role={session.data?.user?.role} />
  return (
    <NotificationWorkspace
      session={session.data}
      onDenied={() => {}}
      embedded={embedded}
      onSelect={onSelect}
    />
  )
}

function NotificationWorkspace({ session, onDenied, embedded, onSelect }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const generation = useRef(0)
  const mutationController = useRef(null)
  const [localCursor, setLocalCursor] = useState('')
  const cursor = embedded ? localCursor : search.cursor || ''
  const path = `/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
  const notifications = useQuery({
    queryKey: [...notificationRoot, session.user.id, 'all', cursor, 60],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(`/api/v1${path}`, { signal })
      } catch (error) {
        if (error.status === 401) onDenied()
        throw error
      }
    },
  })
  useEffect(
    () => () => {
      generation.current += 1
      mutationController.current?.abort()
    },
    [],
  )
  const read = useMutation({
    meta: { localError: true },
    retry: false,
    networkMode: 'always',
    mutationFn: async (item) => {
      const current = generation.current
      const controller = new AbortController()
      mutationController.current = controller
      const result = await api.request(`/api/v1/notifications/${item.id}`, {
        method: 'PATCH',
        csrf: session.csrf,
        body: { expected_version: item.version },
        signal: controller.signal,
      })
      if (current !== generation.current)
        throw new DOMException('Stale authorization', 'AbortError')
      return result
    },
    onError: (error) => {
      if (error.status === 401) onDenied()
    },
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: [...notificationRoot, session.user.id],
      })
    },
  })

  if (notifications.isPending)
    return (
      <PageLoading
        title={strings.notificationsTitle || 'Notifications'}
        className={embedded ? 'min-h-45' : undefined}
      />
    )
  if (notifications.isError)
    return (
      <RetryableError page onRetry={() => void notifications.refetch()}>
        {strings.unavailable}
      </RetryableError>
    )

  const move = (link) =>
    embedded
      ? setLocalCursor(cursorFrom(link, '/notifications'))
      : navigate({
          to: '/notifications',
          search: { cursor: cursorFrom(link, '/notifications') },
        })
  return (
    <section className="grid gap-6" aria-busy={notifications.isFetching}>
      {!embedded && (
        <>
          <Helmet>
            <title>Notifications - MJL</title>
          </Helmet>
          <div
            className="flex justify-between items-center gap-5 flex-wrap [&_h1]:text-navy [&_h1]:font-semibold [&_h1]:text-[1.75rem] [&_nav]:flex [&_nav]:gap-5 max-[641px]:items-start"
            data-ui="planning-heading"
          >
            <RefreshIndicator active={notifications.isFetching} />
            <div>
              <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">
                Suivi administratif
              </p>
              <h1>Notifications</h1>
            </div>
          </div>
        </>
      )}
      <Panel as="div" className={embedded ? 'border-0 p-0 gap-0' : undefined}>
        {notifications.data.data.length === 0 ? (
          <div className="min-h-45 grid items-center">
            <EmptyContent kind="notifications" />
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-border p-0">
            {notifications.data.data.map((item) => (
              <li key={item.id} className="px-6 py-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span
                    className={item.read_at ? '' : 'font-medium text-primary'}
                  >
                    {!item.read_at && <span aria-hidden="true">● </span>}
                    {item.read_at ? strings.read : strings.unread}
                  </span>
                  <time dateTime={item.created_at}>
                    {formatDateTime(item.created_at)}
                  </time>
                </div>
                <h3 className="mb-2 text-sm font-semibold text-navy">
                  {item.kind === 'assignment'
                    ? strings.assignmentTitle
                    : strings.deadlineTitle}
                </h3>
                <p className="text-sm text-navy">{item.activity_name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.kind === 'assignment'
                    ? strings.formatString(strings.assignment, {
                        assigner: item.assigned_by,
                        pta: item.pta_name,
                        project: item.project_name,
                      })
                    : strings.formatString(strings.deadline, {
                        date: formatDate(item.planned_end),
                      })}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    {item.activity_reference}
                    {item.pta_year ? ` · PTA ${item.pta_year}` : ''}
                  </span>
                  <Link
                    className="inline-flex items-center gap-2 font-medium text-primary"
                    to="/activities/$activityId"
                    params={{ activityId: item.activity_id }}
                    aria-disabled={read.isPending}
                    onClick={async (event) => {
                      if (item.read_at) {
                        onSelect?.()
                        return
                      }
                      event.preventDefault()
                      if (read.isPending) return
                      const current = generation.current
                      try {
                        await read.mutateAsync(item)
                        if (current !== generation.current) return
                        await navigate({
                          to: '/activities/$activityId',
                          params: { activityId: item.activity_id },
                        })
                        onSelect?.()
                      } catch (error) {
                        if (
                          error.name !== 'AbortError' &&
                          current === generation.current
                        )
                          toast.error(strings.readFailed)
                      }
                    }}
                  >
                    {strings.openActivity}
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        {(notifications.data.next || notifications.data.previous) && (
          <nav
            className="flex gap-2 items-end flex-wrap"
            aria-label="Pages de notifications"
          >
            <button
              type="button"
              disabled={!notifications.data.previous}
              onClick={() => move(notifications.data.previous)}
            >
              Précédent
            </button>
            <button
              type="button"
              disabled={!notifications.data.next}
              onClick={() => move(notifications.data.next)}
            >
              Suivant
            </button>
          </nav>
        )}
      </Panel>
    </section>
  )
}

export function NotificationsLoading() {
  return <PageLoading title={strings.notificationsTitle} />
}
