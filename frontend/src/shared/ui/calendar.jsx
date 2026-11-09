import { DayPicker } from 'react-day-picker'
import { fr } from 'react-day-picker/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Select } from './select'

// shadcn Calendar composition: DayPicker supplies keyboard/date semantics.
// https://ui.shadcn.com/docs/components/radix/calendar
export function Calendar(props) {
  return (
    <DayPicker
      locale={fr}
      showOutsideDays
      captionLayout="dropdown"
      className="p-3"
      classNames={{
        months: 'relative flex flex-col',
        month: 'space-y-3',
        month_caption: 'flex h-10 items-center justify-center px-8',
        dropdowns: 'flex gap-1',
        caption_label: 'sr-only',
        nav: 'absolute inset-x-0 top-1 flex justify-between',
        button_previous:
          'z-10 flex size-8 items-center justify-center rounded-control hover:bg-selected disabled:opacity-40',
        button_next:
          'z-10 flex size-8 items-center justify-center rounded-control hover:bg-selected disabled:opacity-40',
        month_grid: 'w-full border-collapse text-sm',
        weekdays: 'flex',
        weekday: 'w-9 text-center text-xs font-normal text-muted-foreground',
        week: 'mt-1 flex',
        day: 'relative size-9 p-0 text-center',
        day_button:
          'flex size-9 items-center justify-center rounded-control hover:bg-selected focus-visible:outline-2 focus-visible:outline-primary',
        selected: '[&>button]:bg-primary [&>button]:text-white',
        today:
          '[&>button]:font-semibold [&>button]:ring-1 [&>button]:ring-primary',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'opacity-30',
        hidden: 'invisible',
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft size={16} />
          ) : (
            <ChevronRight size={16} />
          ),
        Dropdown: ({
          options,
          value,
          onChange,
          'aria-label': label,
          disabled,
        }) => (
          <Select
            aria-label={label}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className="min-h-8 border-0 px-1 py-0"
          >
            {options?.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </Select>
        ),
      }}
      {...props}
    />
  )
}
