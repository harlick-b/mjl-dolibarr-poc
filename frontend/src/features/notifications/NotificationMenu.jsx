import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAPI } from '@/shared/api/RestClientProvider'
import { useAccess } from '@/features/auth/session/access-verification'
import { Modal } from '@/shared/ui/BusinessModal'
import { Button } from '@/shared/ui/button'
import { NotificationView } from './NotificationView'
import { notificationAPIPath, notificationPath } from './notification-path'
import { strings } from '@/locales/fr/Navigation'
import { strings as notificationStrings } from '@/locales/fr/NotificationView'
import { cursorFrom } from '@/shared/lib/pagination'
import { toast } from 'sonner'

// Temporarily keep the bulk-read action out of the Notifications modal.
const showMarkAllRead = false

async function markAllRead(api, csrf) {
  let cursor = ''
  const visited = new Set()
  do {
    const query = new URLSearchParams({ state: 'unread', limit: '100' })
    if (cursor) query.set('cursor', cursor)
    const page = await api.request(`${notificationAPIPath}?${query}`)
    for (const item of page.data)
      await api.request(`${notificationAPIPath}/${item.id}`, {
        method: 'PATCH',
        csrf,
        body: { expected_version: item.version },
      })
    const next = cursorFrom(page.next, notificationPath)
    cursor = next && !visited.has(next) ? next : ''
    if (cursor) visited.add(cursor)
  } while (cursor)
}

export function NotificationMenu() {
  const access = useAccess()
  const { api } = useAPI()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const opener = useRef(null)
  const unread = useQuery({
    queryKey: ['notifications', access.user?.id, 'unread', '', 1],
    queryFn: ({ signal }) =>
      api.request(`${notificationAPIPath}?state=unread&limit=1`, { signal }),
    enabled: access.can('notifications'),
  })
  const markAll = useMutation({
    meta: { localError: true },
    mutationFn: () => markAllRead(api, access.session.csrf),
    onError: () => toast.error(notificationStrings.markAllFailed),
    onSettled: async () => {
      await client.invalidateQueries({
        queryKey: ['notifications', access.user.id],
      })
    },
  })
  if (!access.can('notifications')) return null
  return (
    <>
      <Button
        ref={opener}
        variant="ghost"
        className="mb-3 w-full justify-start gap-3 px-3 text-navy"
        aria-label={
          unread.data?.count > 0
            ? `${strings.notifications}, ${strings.formatString(
                strings.unread,
                {
                  count: unread.data.count,
                },
              )}`
            : strings.notifications
        }
        onClick={() => {
          setOpen(true)
          void unread.refetch()
        }}
      >
        {strings.notifications}
        {unread.data?.count > 0 && (
          <span
            aria-hidden="true"
            className="rounded-full bg-primary px-2 text-xs text-white"
          >
            {unread.data.count}
          </span>
        )}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        opener={opener}
        label={strings.notifications}
        headerAction={
          showMarkAllRead && unread.data?.count > 0 ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="text-xs font-normal"
              loading={markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              {notificationStrings.markAllRead}
            </Button>
          ) : null
        }
        className="max-h-[min(720px,calc(100dvh-32px))] w-[min(560px,calc(100%-32px))] overflow-hidden backdrop:backdrop-blur-sm open:flex open:flex-col [&>header]:shrink-0 [&>section]:min-h-0 [&>section]:flex-1"
      >
        {open && <NotificationView onSelect={() => setOpen(false)} />}
      </Modal>
    </>
  )
}
