import {
  formatDate,
  formatExactPercentage,
  formatXof,
} from '@/shared/lib/format'

export function CompactAllocationTable({
  rows,
  nameHeader,
  amountHeader,
  weightHeader,
  actionsHeader,
  categoryFor,
  datesToComplete,
  detailFor,
  renderActions,
  footer,
}) {
  const hasActions = Boolean(renderActions)
  return (
    <div className="overflow-x-auto" data-ui="planning-list">
      <table className="w-full min-w-150 table-fixed text-left text-[0.8125rem] leading-5">
        <colgroup>
          <col />
          <col className="w-40" />
          <col className="w-28" />
          {hasActions && <col className="w-44" />}
        </colgroup>
        <thead className="border-b border-border bg-white">
          <tr>
            <th className="px-3 py-3 font-medium">{nameHeader}</th>
            <th className="whitespace-nowrap px-3 py-3 font-medium">
              {amountHeader}
            </th>
            <th className="px-3 py-3 font-medium">{weightHeader}</th>
            {hasActions && (
              <th className="px-3 py-3 font-medium">{actionsHeader}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id || row._key}
              className="border-b border-border last:border-b-0"
            >
              <td className="px-3 py-3 align-top">
                <strong className="font-semibold">{row.name}</strong>
                {categoryFor?.(row) && (
                  <small className="block text-muted-foreground">
                    {categoryFor(row)}
                  </small>
                )}
                <small className="block text-muted-foreground">
                  {row.planned_start && row.planned_end
                    ? `${formatDate(row.planned_start)} – ${formatDate(row.planned_end)}`
                    : datesToComplete}
                  {detailFor?.(row) || ''}
                </small>
              </td>
              <td className="px-3 py-3 align-top font-medium">
                {formatXof(row.allocation)}
              </td>
              <td className="px-3 py-3 align-top text-muted-foreground">
                {formatExactPercentage(row.weight)}
              </td>
              {hasActions && (
                <td className="px-3 py-3 align-top">
                  {renderActions(row, index)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  )
}
