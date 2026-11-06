import { EmptyContent } from '@/shared/ui/EmptyContent'
import { businessActionClassName } from '@/shared/ui/button-variants'
import { Panel } from '@/shared/ui/layout'
import { useSessionQuery } from '@/features/auth/SessionProvider'
import { authorization } from '@/features/auth/authorization'
import { PageLoading, RefreshIndicator } from '@/shared/ui/PageLoading'
import { strings } from '@/locales/fr/NotificationView'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Bell, Check } from 'lucide-react'
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
    gcTime: 0,
  })
  useEffect(
    () => () => {
      generation.current += 1
      mutationController.current?.abort()
    },
    [],
  )
  const read = useMutation({
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
      toast.success(strings.markedRead)
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
            <title>Notifications — MJL</title>
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
          <ul className="grid list-none m-0 p-0 [&_li]:grid [&_li]:grid-cols-[auto_minmax(0,_1fr)_auto] [&_li]:gap-4 [&_li]:items-start [&_li]:py-5 [&_li]:px-3 [&_li]:border-b [&_li]:border-b-border [&_li[data-ui~='is-unread']]:bg-selected [&_p]:my-[6px] [&_p]:mx-0 [&_small]:text-muted-foreground max-[641px]:[&_li]:grid-cols-[auto_1fr] max-[641px]:[&_button]:col-span-full">
            {notifications.data.data.map((item) => (
              <li key={item.id} data-ui={item.read_at ? '' : 'is-unread'}>
                <Bell aria-hidden="true" size={20} />
                <div>
                  <Link
                    onClick={onSelect}
                    to="/activities/$activityId"
                    params={{ activityId: item.activity_id }}
                  >
                    {item.activity_reference} — {item.activity_name}
                  </Link>
                  <p>
                    Échéance le{' '}
                    {new Intl.DateTimeFormat('fr-FR').format(
                      new Date(`${item.planned_end}T00:00:00`),
                    )}
                  </p>
                  <small>
                    Courriel :{' '}
                    {{
                      delivered: 'envoyé',
                      failed: 'échec enregistré',
                      skipped: 'non envoyé',
                      unconfirmed: 'résultat non confirmé',
                    }[item.email_status] || item.email_status}
                  </small>
                </div>
                {!item.read_at && (
                  <button
                    className={businessActionClassName}
                    disabled={read.isPending}
                    onClick={() => read.mutate(item)}
                    type="button"
                  >
                    <Check aria-hidden="true" size={18} /> Marquer comme lue
                  </button>
                )}
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
