import { cn } from '@/shared/lib/utils'
import { strings } from '@/locales/fr/EmptyContent'
export function EmptyContent({ kind, action, large = false }) {
  const [title, message] = strings[kind]
  return (
    <div
      data-ui="empty-content"
      className={cn(
        'grid min-h-38 content-center justify-items-center gap-2.5 px-6 py-8 text-center',
        large && 'min-h-54',
      )}
    >
      {title && (
        <h2 className="w-full text-center! text-base font-medium! text-foreground">
          {title}
        </h2>
      )}
      <p className="max-w-120 text-[0.8125rem] leading-[1.65] text-muted-foreground">
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
                className={cn(
                  'border-b border-border px-3 py-3 font-medium text-navy',
                  column === 'budget' && 'text-right',
                )}
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
