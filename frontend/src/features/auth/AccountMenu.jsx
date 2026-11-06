import { useId, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronUp, UserRound, LogOut, Users, Folder } from 'lucide-react'
import { authorization, roleLabels } from './authorization'
import { useLogout } from './LogoutProvider'
import { strings } from '@/locales/fr/AccountMenu'

export function AccountMenu({ user }) {
  const id = useId()
  const trigger = useRef(null)
  const [open, setOpen] = useState(false)
  const { logout } = useLogout()
  const policy = authorization({ state: 'verified', user })
  const items = useRef(null)
  function focusItem(last = false) {
    const controls = items.current?.querySelectorAll('[role="menuitem"]')
    controls?.[last ? controls.length - 1 : 0]?.focus()
  }
  if (!user) return null
  const name = user.full_name?.trim() || user.email
  const words = user.full_name?.trim().split(/\s+/).filter(Boolean) || []
  const initials = words.length
    ? [words[0], ...(words.length > 1 ? [words.at(-1)] : [])]
        .map((word) => Array.from(word)[0])
        .join('')
        .toLocaleUpperCase('fr')
    : Array.from(user.email || '?')[0].toLocaleUpperCase('fr')
  return (
    <div
      className="relative mt-auto border-t border-border pt-4"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      {open && (
        <div
          id={id}
          ref={items}
          role="menu"
          aria-label={strings.account}
          className="absolute bottom-full left-0 z-30 mb-2 max-[761px]:bottom-auto max-[761px]:top-full max-[761px]:mt-2 w-full min-w-52 rounded-card border border-border bg-white p-1 shadow-lg [&_a]:flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-card [&_a]:px-3 [&_a]:text-sm [&_a]:text-navy [&_a:hover]:bg-selected [&_button]:min-h-11 [&_button]:w-full [&_button]:rounded-card [&_button]:px-3 [&_button]:text-left [&_button]:text-sm [&_button:hover]:bg-selected"
          onKeyDown={(event) => {
            const controls = [
              ...items.current.querySelectorAll('[role="menuitem"]'),
            ]
            const current = controls.indexOf(document.activeElement)
            const index =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? controls.length - 1
                  : event.key === 'ArrowDown'
                    ? (current + 1) % controls.length
                    : event.key === 'ArrowUp'
                      ? (current - 1 + controls.length) % controls.length
                      : null
            if (index !== null) {
              event.preventDefault()
              controls[index].focus()
            }
          }}
        >
          <div className="border-b border-border px-3 py-3 mb-1">
            <p
              className="truncate text-sm font-semibold text-navy"
              title={name}
            >
              {name}
            </p>
            <p
              className="truncate mt-1 text-xs text-muted-foreground"
              title={user.email}
            >
              {user.email}
            </p>
          </div>
          <Link role="menuitem" to="/identity" onClick={() => setOpen(false)}>
            <UserRound size={16} aria-hidden="true" className="mr-2 shrink-0" />
            {strings.profile}
          </Link>
          {policy.can('accounts') && (
            <Link
              role="menuitem"
              to="/access/users"
              onClick={() => setOpen(false)}
            >
              <Users size={16} aria-hidden="true" className="mr-2 shrink-0" />
              {strings.users}
            </Link>
          )}
          {policy.can('partner') && (
            <Link role="menuitem" to="/partner" onClick={() => setOpen(false)}>
              <Folder size={16} aria-hidden="true" className="mr-2 shrink-0" />
              {strings.partner}
            </Link>
          )}
          <button
            className="mt-1 flex items-center border-t border-border text-danger"
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false)
              void logout()
            }}
          >
            <LogOut size={16} aria-hidden="true" className="mr-2 shrink-0" />
            {strings.logout}
          </button>
        </div>
      )}
      <button
        ref={trigger}
        type="button"
        aria-label={strings.account}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="flex min-h-16 w-full items-center gap-3 rounded-card px-2 text-left text-navy hover:bg-selected"
        onClick={() => {
          setOpen(!open)
          if (!open) requestAnimationFrame(() => focusItem())
        }}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault()
            setOpen(true)
            requestAnimationFrame(() => focusItem(event.key === 'ArrowUp'))
          }
        }}
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-control bg-selected text-xs font-semibold text-primary"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1 text-[0.8125rem]">
          <span className="block truncate font-medium" title={name}>
            {name}
          </span>
          <small className="mt-1 block truncate text-xs text-muted-foreground">
            {roleLabels[user.role]}
          </small>
        </span>
        <ChevronUp
          size={16}
          aria-hidden="true"
          className={open ? 'shrink-0 rotate-180' : 'shrink-0'}
        />
      </button>
    </div>
  )
}
