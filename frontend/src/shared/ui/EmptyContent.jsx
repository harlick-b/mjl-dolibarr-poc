import { cn } from '@/shared/lib/utils'
import { strings } from '@/locales/fr/EmptyContent'
export function EmptyContent({ kind, action, large = false }) {
  const [title, message] = strings[kind]
  return (
    <div
      data-ui="empty-content"
      className={cn(
        'grid min-h-38 content-center justify-items-center gap-3 px-5 py-10 text-center',
        large && 'min-h-54',
      )}
    >
      {title && <h2 className="text-base font-medium! text-navy">{title}</h2>}
      <p className="max-w-140 text-[0.8125rem] leading-6 text-muted-foreground">
        {message}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
export function EmptyTable({ kind, columns }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-white">
      <table className="w-full text-left text-[0.8125rem]">
        <thead className="bg-background">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="border-b border-border px-3 py-3 font-medium text-navy"
              >
                {strings[column]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length} className="p-0!">
              <EmptyContent kind={kind} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
