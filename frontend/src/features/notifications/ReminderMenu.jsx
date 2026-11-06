import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, X } from 'lucide-react'
import { useAPI } from '@/shared/api/RestClientProvider'
import { useAccess } from '@/features/auth/access-verification'
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
    enabled: access.role === 'AGENT_SAISIE',
    gcTime: 0,
  })
  if (!access.can('notifications')) return null
  return (
    <>
      <Button ref={opener} variant="outline" onClick={() => setOpen(true)}>
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
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-semibold">{strings.remindersTitle}</h2>
          <Button
            variant="ghost"
            aria-label={strings.close}
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </Button>
        </header>
        {open && <NotificationView embedded onSelect={() => setOpen(false)} />}
      </Modal>
    </>
  )
}
