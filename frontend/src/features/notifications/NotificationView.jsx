import { formatDate, formatDateTime } from '@/shared/lib/format'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { useSessionQuery } from '@/features/auth/session/SessionProvider'
import { authorization } from '@/features/auth/session/authorization'
import { strings } from '@/locales/fr/NotificationView'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { cursorFrom } from '@/shared/lib/pagination'
import { useAPI } from '@/shared/api/RestClientProvider'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'
import { Pagination } from '@/shared/ui/Pagination'
import { activityLocation } from '@/shared/lib/activity-navigation'
import { notificationAPIPath, notificationPath } from './notification-path'
import { LoaderCircle } from 'lucide-react'

const notificationRoot = ['notifications']

function NotificationLoading() {
  return (
    <div
      data-ui="notification-loading"
      className="min-h-45 grid place-content-center text-primary"
      role="status"
      aria-label={strings.loading}
      aria-busy="true"
    >
      <LoaderCircle
        className="animate-spin [animation-duration:0.8s]"
        size={22}
        aria-hidden="true"
      />
    </div>
  )
}

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
  const activity = {
    id: item.activity_id,
    approved_revision_id: item.approved_revision_id,
  }
  const activityDestination = (section = 'programming') =>
    activityLocation(activity, section)
  if (
    item.handled_at &&
    ['activity_review', 'financial_review'].includes(item.kind)
  )
    return {
      title:
        item.kind === 'financial_review'
          ? strings.handledRequestTitle
          : strings.handledActivityTitle,
      description: strings.handledDescription,
      location: activityDestination(
        item.kind === 'financial_review' ? 'finance' : 'programming',
      ),
      action: strings.consultActivity,
    }
  if (item.kind === 'assignment')
    return {
      title: strings.assignmentTitle,
      description: strings.formatString(strings.assignment, {
        assigner: item.assigned_by,
        pta: item.pta_name,
        project: item.project_name,
      }),
      location: activityDestination(),
      action: strings.viewActivity,
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
      location: activityDestination(),
      action: strings.viewRealization,
    }
  if (item.kind === 'activity_correction')
    return {
      title: strings.correctionTitle,
      description: strings.formatString(strings.correction, {
        reason: item.reason,
      }),
      location: activityDestination(),
      action: strings.correctActivity,
    }
  if (item.kind === 'activity_approved')
    return {
      title: strings.approvedTitle,
      description: strings.approved,
      location: activityDestination(),
      action: strings.viewActivity,
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
        location: activityDestination('finance'),
        action: strings.openRequest,
      }
    if (item.kind === 'financial_correction')
      return {
        title: strings.financialCorrectionTitle,
        description: strings.formatString(strings.financialCorrection, {
          request,
          reason: item.reason,
        }),
        location: activityDestination('finance'),
        action: strings.correctRequest,
      }
    return {
      title: strings.financialApprovedTitle,
      description: strings.formatString(strings.financialApproved, { request }),
      location: activityDestination('finance'),
      action: strings.consultActivity,
    }
  }
  return {
    title: strings.deadlineTitle,
    description: strings.formatString(strings.deadline, {
      date: formatDate(item.planned_end),
    }),
    location: activityDestination(),
    action: strings.viewActivity,
  }
}

export function NotificationView({ onSelect }) {
  const session = useSessionQuery()
  if (session.isPending) return <NotificationLoading />
  if (!authorization(session.data).can('notifications'))
    return <AccessDeniedState role={session.data?.user?.role} />
  return (
    <NotificationWorkspace
      session={session.data}
      onDenied={() => {}}
      onSelect={onSelect}
    />
  )
}

function NotificationWorkspace({ session, onDenied, onSelect }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const navigate = useNavigate()
  const generation = useRef(0)
  const mutationController = useRef(null)
  const [cursor, setCursor] = useState('')
  const path = `${notificationAPIPath}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
  const notifications = useQuery({
    queryKey: [...notificationRoot, session.user.id, 'all', cursor, 60],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(path, { signal })
      } catch (error) {
        if (error.status === 401) onDenied()
        throw error
      }
    },
    refetchOnMount: 'always',
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
      const result = await api.request(`${notificationAPIPath}/${item.id}`, {
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

  if (notifications.isPending) return <NotificationLoading />
  if (notifications.isError)
    return (
      <RetryableError onRetry={() => void notifications.refetch()}>
        {strings.unavailable}
      </RetryableError>
    )

  const move = (link) => setCursor(cursorFrom(link, notificationPath))
  return (
    <section
      className="flex min-h-0 flex-col overflow-y-auto overscroll-contain"
      aria-busy={notifications.isFetching}
    >
      <div className="min-h-0">
        {notifications.data.data.length === 0 ? (
          <div className="min-h-45 grid items-center">
            <EmptyContent kind="notifications" />
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-border p-0">
            {notifications.data.data.map((item) => {
              const presentation = notificationPresentation(item)
              return (
                <li
                  key={item.id}
                  className={
                    item.read_at ? 'px-5 py-4' : 'bg-selected px-5 py-4'
                  }
                >
                  <span className="sr-only">
                    {item.handled_at
                      ? item.read_at
                        ? strings.handled
                        : strings.handledUnread
                      : item.read_at
                        ? strings.read
                        : strings.unread}
                  </span>
                  <h3 className="text-sm font-semibold text-navy">
                    {presentation.title}
                  </h3>
                  <p className="mt-1 text-[0.8125rem] text-navy">
                    {item.activity_name}
                  </p>
                  <p className="mt-1 text-[0.8125rem] leading-5 text-muted-foreground">
                    {item.activity_reference && `${item.activity_reference} : `}
                    {presentation.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <time
                      dateTime={item.created_at}
                      className="text-muted-foreground"
                    >
                      {formatDateTime(item.created_at)}
                    </time>
                    <Link
                      className="inline-flex min-h-8 items-center font-medium text-primary hover:underline"
                      {...presentation.location}
                      aria-disabled={read.isPending}
                      onClick={async (event) => {
                        if (item.read_at) {
                          void client.invalidateQueries({
                            queryKey: [...notificationRoot, session.user.id],
                          })
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
                            ...presentation.location,
                          })
                          onSelect?.()
                        } catch (error) {
                          if (
                            error.name !== 'AbortError' &&
                            current === generation.current
                          ) {
                            toast.error(strings.readFailed)
                            await navigate({
                              ...presentation.location,
                            })
                            onSelect?.()
                          }
                        }
                      }}
                    >
                      {presentation.action}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <Pagination
          label={strings.paginationLabel}
          canPrevious={Boolean(notifications.data.previous)}
          canNext={Boolean(notifications.data.next)}
          busy={notifications.isFetching}
          previousLabel={strings.previous}
          nextLabel={strings.next}
          size="sm"
          className="border-t border-border px-5 py-3"
          onPrevious={() => move(notifications.data.previous)}
          onNext={() => move(notifications.data.next)}
        />
      </div>
    </section>
  )
}
