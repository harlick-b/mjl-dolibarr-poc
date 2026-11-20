import { Fragment } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { cn } from '@/shared/lib/utils'

export function Breadcrumbs({ label, items, className }) {
  const router = useRouter({ warn: false })
  return (
    <nav
      aria-label={label}
      className={cn(
        'flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground',
        className,
      )}
    >
      {items.map((item, index) => (
        <Fragment key={`${item.label}:${index}`}>
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.to && router ? (
            <Link
              to={item.to}
              params={item.params}
              search={item.search}
              onClick={item.onClick}
              className="text-primary"
            >
              {item.label}
            </Link>
          ) : item.to ? (
            <a href="#" onClick={item.onClick} className="text-primary">
              {item.label}
            </a>
          ) : (
            <span
              aria-current={index === items.length - 1 ? 'page' : undefined}
            >
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
