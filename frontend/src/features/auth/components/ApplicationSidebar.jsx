import { Urls } from '@/app/urls'
import { Link, useLocation } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Folder,
  ClipboardList,
  Building2,
  Users,
  History,
  Bell,
  Download,
} from 'lucide-react'
import { authorization, pageForPath } from '../session/authorization'
import { ReminderMenu } from '@/features/notifications/ReminderMenu'
import { AccountMenu } from './AccountMenu'
import { strings } from '@/locales/fr/Navigation'
const icons = {
  dashboard: LayoutDashboard,
  planning: Folder,
  execution: ClipboardList,
  partners: Building2,
  projects: Folder,
  accounts: Users,
  audit: History,
  notifications: Bell,
  exports: Download,
}
export function ApplicationSidebar({ user }) {
  const path = useLocation({ select: (location) => location.pathname })
  const policy = authorization(user ? { state: 'verified', user } : null)
  const active = pageForPath(path)?.id
  return (
    <aside
      data-ui="access-sidebar"
      className="sticky top-0 flex h-dvh min-w-0 flex-col border-r border-border bg-white max-[761px]:static max-[761px]:h-auto max-[761px]:border-r-0 max-[761px]:border-b"
    >
      <Link
        to={policy.workspace}
        aria-label={
          policy.workspace === Urls.dashboard
            ? strings.brand
            : `MJL — ${strings.accounts}`
        }
        className="flex h-24 shrink-0 items-center px-6"
      >
        <img
          src="/logo-192.png"
          alt=""
          width="40"
          height="40"
          className="rounded-control"
        />
      </Link>
      {policy.can('partner') && (
        <p className="px-6 pb-4 text-xs text-muted-foreground">
          {strings.partnerSpace} · {strings.readOnly}
        </p>
      )}
      <nav
        aria-label={
          policy.can('accounts')
            ? strings.administration
            : policy.can('partner')
              ? strings.partnerSpace
              : strings.workspace
        }
        className="grid gap-2 overflow-y-auto px-4 py-3 max-[761px]:flex max-[761px]:overflow-x-auto"
      >
        {policy.navigation.map((page) => {
          const Icon = icons[page.icon]
          return (
            <Link
              key={page.id}
              to={page.path}
              activeOptions={{ exact: true }}
              activeProps={{
                'aria-current': active === page.id ? 'page' : undefined,
              }}
              aria-current={active === page.id ? 'page' : undefined}
              className="flex min-h-11 shrink-0 items-center gap-3 rounded-card px-3 py-2 text-sm text-navy hover:bg-background aria-[current=page]:bg-selected aria-[current=page]:font-semibold aria-[current=page]:text-primary"
            >
              <Icon size={18} aria-hidden="true" />
              {page.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto min-w-0 px-4 pb-4 pt-6">
        <ReminderMenu />
        <AccountMenu user={user} />
      </div>
    </aside>
  )
}
