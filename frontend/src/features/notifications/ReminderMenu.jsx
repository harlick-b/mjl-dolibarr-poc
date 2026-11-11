import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { useAPI } from '@/shared/api/RestClientProvider'
import { useAccess } from '@/features/auth/session/access-verification'
import { Modal } from '@/shared/ui/BusinessModal'
import { Button } from '@/shared/ui/button'
import { NotificationView } from './NotificationView'
import { strings } from '@/locales/fr/Navigation'
export function ReminderMenu() {
  const access = useAccess()
  const { api } = useAPI()
  const [open, setOpen] = useState(false)
  const opener = useRef(null)
  const unread = useQuery({
    queryKey: ['notifications', access.user?.id, 'unread', '', 1],
    queryFn: ({ signal }) =>
      api.request('/api/v1/notifications?state=unread&limit=1', { signal }),
    enabled: access.can('notifications'),
  })
  if (!access.can('notifications')) return null
  return (
    <>
      <Button
        ref={opener}
        variant="ghost"
        className="mb-3 w-full justify-start gap-3 px-3 text-navy"
        onClick={() => {
          setOpen(true)
          void unread.refetch()
        }}
      >
        <Clock size={14} aria-hidden="true" />
        {strings.reminders}
        {unread.data?.count > 0 && (
          <span
            aria-label={strings.formatString(strings.unread, {
              count: unread.data.count,
            })}
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
        label={strings.remindersTitle}
        className="w-[min(760px,calc(100%-32px))] backdrop:backdrop-blur-sm"
      >
        {open && <NotificationView embedded onSelect={() => setOpen(false)} />}
      </Modal>
    </>
  )
}
