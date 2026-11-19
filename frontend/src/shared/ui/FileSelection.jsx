import { Button } from './button'

export function FileSelection({
  label,
  chooseLabel,
  emptyLabel,
  file,
  disabled = false,
  className = '',
  ...inputProps
}) {
  return (
    <label className={`grid gap-[6px] ${className}`}>
      {label}
      <span
        data-ui="file-selection"
        className="flex min-h-10 min-w-0 items-center gap-3 rounded-control border border-strong-border bg-white px-[11px] py-[6px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
      >
        <Button
          asChild
          type="button"
          size="sm"
          variant="outline"
          className={`shrink-0 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <span>{chooseLabel}</span>
        </Button>
        <span className="min-w-0 truncate text-sm font-normal text-muted-foreground">
          {file?.name || emptyLabel}
        </span>
        <input
          {...inputProps}
          className="sr-only"
          aria-label={label}
          type="file"
          disabled={disabled}
        />
      </span>
    </label>
  )
}
