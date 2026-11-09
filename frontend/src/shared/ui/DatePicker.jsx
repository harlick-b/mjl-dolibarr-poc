import { useCallback, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays } from 'lucide-react'
import { Calendar } from './calendar'
import { Button } from './button'
import { formatDate } from '@/shared/lib/format'
import { strings } from '@/locales/fr/DatePicker'

function localDate(value) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
export function DatePicker({
  value,
  onChange,
  label,
  min,
  max,
  optional = false,
  ...triggerProps
}) {
  const [open, setOpen] = useState(false)
  const [container, setContainer] = useState(undefined)
  const trigger = useCallback(
    (node) => setContainer(node?.closest('dialog') || undefined),
    [],
  )
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          {...triggerProps}
          ref={trigger}
          type="button"
          variant="outline"
          aria-label={`${label} : ${value ? formatDate(value) : strings.choose}`}
          className="w-full justify-between text-left font-normal"
        >
          <span>{value ? formatDate(value) : strings.choose}</span>
          <CalendarDays size={15} className="text-muted-foreground" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          align="start"
          sideOffset={5}
          className="z-50 rounded-panel border border-border bg-white shadow-md"
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          <Calendar
            mode="single"
            selected={localDate(value)}
            defaultMonth={localDate(value || min)}
            startMonth={localDate(min || '2000-01-01')}
            endMonth={localDate(max || '2200-12-31')}
            disabled={[
              ...(min ? [{ before: localDate(min) }] : []),
              ...(max ? [{ after: localDate(max) }] : []),
            ]}
            onSelect={(date) => {
              if (!date) return
              onChange(
                `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
              )
              setOpen(false)
            }}
            autoFocus
          />
          {optional && value && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              {strings.clear}
            </Button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
