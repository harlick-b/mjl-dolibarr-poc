import { Link } from '@tanstack/react-router'
import { ChevronRight, History, UserRound, Users } from 'lucide-react'
import { strings } from '@/locales/fr/AdminSidebar'
import { strings as common } from '@/locales/fr/common'

export function AdminSidebar({ user }) {
  const Destination = user ? Link : 'span'
  return (
    <aside className="access-sidebar">
      <Destination
        {...(user ? { to: '/access/users' } : {})}
        className="access-brand"
        aria-label={strings.adminHome}
      >
        <img src="/icon-192.png" alt="" width="40" height="40" />
        <span>MJL</span>
      </Destination>
      <nav aria-label={strings.administration}>
        <Destination
          {...(user ? { to: '/access/users' } : {})}
          {...(user
            ? { activeProps: { 'aria-current': 'page' } }
            : { className: 'access-nav-label' })}
        >
          <Users aria-hidden="true" size={18} />
          {common.usersTitle}
        </Destination>
        <Destination
          {...(user ? { to: '/history' } : {})}
          {...(user
            ? { activeProps: { 'aria-current': 'page' } }
            : { className: 'access-nav-label' })}
        >
          <History aria-hidden="true" size={18} />
          {strings.adminHistory}
        </Destination>
      </nav>
      <Destination
        {...(user ? { to: '/identity' } : {})}
        className="access-account"
        aria-label={common.accountHeading}
      >
        <span className="access-avatar" aria-hidden="true">
          <UserRound size={18} />
        </span>
        <span className="access-account-details">
          {user?.email || common.accountHeading}
          {user && <small>{strings.adminRole}</small>}
        </span>
        <ChevronRight aria-hidden="true" size={16} />
      </Destination>
    </aside>
  )
}
