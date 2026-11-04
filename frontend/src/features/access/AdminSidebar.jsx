import { Link } from '@tanstack/react-router'
import { ChevronRight, History, UserRound, Users } from 'lucide-react'
import { strings } from '@/shared/i18n'

export function AdminSidebar({ user }) {
  return (
    <aside className="access-sidebar">
      <Link
        to="/access/users"
        className="access-brand"
        aria-label={strings.adminHome}
      >
        <img src="/icon-192.png" alt="" width="40" height="40" />
        <span>MJL</span>
      </Link>
      <nav aria-label={strings.administration}>
        <Link to="/access/users" activeProps={{ 'aria-current': 'page' }}>
          <Users aria-hidden="true" size={18} />
          {strings.usersTitle}
        </Link>
        <Link to="/history" activeProps={{ 'aria-current': 'page' }}>
          <History aria-hidden="true" size={18} />
          {strings.adminHistory}
        </Link>
      </nav>
      <Link
        to="/identity"
        className="access-account"
        aria-label={strings.accountHeading}
      >
        <span className="access-avatar" aria-hidden="true">
          <UserRound size={18} />
        </span>
        <span className="access-account-details">
          {user.email}
          <small>{strings.adminRole}</small>
        </span>
        <ChevronRight aria-hidden="true" size={16} />
      </Link>
    </aside>
  )
}
