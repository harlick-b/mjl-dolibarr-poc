import { Urls } from '@/app/urls'
import { formatDate, formatDateTime } from '@/shared/lib/format'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { Panel } from '@/shared/ui/layout'
import { useSessionQuery } from '@/features/auth/session/SessionProvider'
import { authorization } from '@/features/auth/session/authorization'
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
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'

const notificationRoot = ['notifications']

function financialRequestLabel(kind) {
  return {
    funding: strings.fundingRequest,
    disbursement: strings.disbursementRequest,
    virement: strings.virementRequest,
    zero_spending: strings.zeroSpendingRequest,
  }[kind]
}

function notificationPresentation(item) {
  const financial = item.kind.startsWith('financial_')
  if (item.kind === 'assignment')
    return {
      title: strings.assignmentTitle,
      description: strings.formatString(strings.assignment, {
        assigner: item.assigned_by,
        pta: item.pta_name,
        project: item.project_name,
      }),
      target: Urls.activity,
    }
  if (item.kind === 'activity_review')
    return {
      title:
        item.stage === 'supervisor'
          ? strings.reviewSupervisorTitle
          : strings.reviewValidatorTitle,
      description:
        item.stage === 'supervisor'
          ? strings.reviewSupervisor
          : strings.reviewValidator,
      target: Urls.activity,
    }
  if (item.kind === 'activity_correction')
    return {
      title: strings.correctionTitle,
      description: strings.formatString(strings.correction, {
        reason: item.reason,
      }),
      target: Urls.activity,
    }
  if (item.kind === 'activity_approved')
    return {
      title: strings.approvedTitle,
      description: strings.approved,
      target: Urls.activity,
    }
  if (financial) {
    const request = financialRequestLabel(item.request_kind)
    if (item.kind === 'financial_review')
      return {
        title:
          item.stage === 'supervisor'
            ? strings.financialReviewSupervisorTitle
            : strings.financialReviewValidatorTitle,
        description: strings.formatString(
          item.stage === 'supervisor'
            ? strings.financialReviewSupervisor
            : strings.financialReviewValidator,
          { request },
        ),
        target: Urls.executionActivity,
      }
    if (item.kind === 'financial_correction')
      return {
        title: strings.financialCorrectionTitle,
        description: strings.formatString(strings.financialCorrection, {
          request,
          reason: item.reason,
        }),
        target: Urls.executionActivity,
      }
    return {
      title: strings.financialApprovedTitle,
      description: strings.formatString(strings.financialApproved, { request }),
      target: Urls.executionActivity,
    }
  }
  return {
    title: strings.deadlineTitle,
    description: strings.formatString(strings.deadline, {
      date: formatDate(item.planned_end),
    }),
    target: Urls.activity,
  }
}

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
      ? setLocalCursor(cursorFrom(link, Urls.notifications))
      : navigate({
          to: Urls.notifications,
          search: { cursor: cursorFrom(link, Urls.notifications) },
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
            {notifications.data.data.map((item) => {
              const presentation = notificationPresentation(item)
              return (
                <li key={item.id} className="px-6 py-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span
                      className={item.read_at ? '' : 'font-medium text-primary'}
                    >
                      {!item.read_at && <span aria-hidden="true">● </span>}
                      {item.handled_at
                        ? item.read_at
                          ? strings.handled
                          : strings.handledUnread
                        : item.read_at
                          ? strings.read
                          : strings.unread}
                    </span>
                    <time dateTime={item.created_at}>
                      {formatDateTime(item.created_at)}
                    </time>
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-navy">
                    {presentation.title}
                  </h3>
                  <p className="text-sm text-navy">{item.activity_name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {presentation.description}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {item.activity_reference}
                      {item.pta_year ? ` · PTA ${item.pta_year}` : ''}
                    </span>
                    <Link
                      className="inline-flex items-center gap-2 font-medium text-primary"
                      to={presentation.target}
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
                            to: presentation.target,
                            params: { activityId: item.activity_id },
                          })
                          onSelect?.()
                        } catch (error) {
                          if (
                            error.name !== 'AbortError' &&
                            current === generation.current
                          ) {
                            toast.error(strings.readFailed)
                            await navigate({
                              to: presentation.target,
                              params: { activityId: item.activity_id },
                            })
                            onSelect?.()
                          }
                        }
                      }}
                    >
                      {item.handled_at
                        ? strings.consultActivity
                        : strings.openActivity}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {(notifications.data.next || notifications.data.previous) && (
          <nav
            className="flex gap-2 items-end flex-wrap"
            aria-label={strings.paginationLabel}
          >
            <button
              type="button"
              disabled={
                !notifications.data.previous || notifications.isFetching
              }
              onClick={() => move(notifications.data.previous)}
            >
              {strings.previous}
            </button>
            <button
              type="button"
              disabled={!notifications.data.next || notifications.isFetching}
              onClick={() => move(notifications.data.next)}
            >
              {strings.next}
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
