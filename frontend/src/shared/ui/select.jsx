import { Children, useCallback, useState } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

// shadcn Select composition, with the existing form value/change contract.
// Keep popups inside native dialogs so they remain in the browser's top layer.
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  className,
  ...props
}) {
  const options = Children.toArray(children).filter(
    (child) => child?.type === 'option',
  )
  const [localValue, setLocalValue] = useState(() => defaultValue)
  const [container, setContainer] = useState(undefined)
  const triggerRef = useCallback(
    (node) => setContainer(node?.closest('dialog') || undefined),
    [],
  )
  const selected = String(
    value ??
      (options.some(
        (option) => String(option.props.value) === String(localValue),
      )
        ? localValue
        : options.find((option) => !option.props.disabled)?.props.value) ??
      '',
  )
  const empty = options.find((option) => option.props.value === '')
  return (
    <SelectPrimitive.Root
      name={name}
      required={required}
      disabled={disabled}
      value={selected}
      onValueChange={(next) => {
        const result = next === '__empty__' ? '' : next
        setLocalValue(result)
        onChange?.({ target: { value: result, name } })
      }}
    >
      <SelectPrimitive.Trigger
        ref={triggerRef}
        {...props}
        className={cn(
          'flex min-h-10 w-full items-center justify-between gap-2 rounded-control border border-strong-border bg-white px-3 py-2 text-left text-sm text-foreground disabled:cursor-not-allowed disabled:bg-disabled focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&>span]:truncate',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={empty?.props.children} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={container}>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-panel border border-border bg-white text-foreground shadow-md"
        >
          <SelectPrimitive.ScrollUpButton className="flex justify-center py-1">
            <ChevronUp size={16} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.key}
                value={String(option.props.value) || '__empty__'}
                disabled={option.props.disabled}
                className="relative flex min-h-10 cursor-default items-center rounded px-3 pr-8 text-sm outline-none data-[highlighted]:bg-selected data-[highlighted]:text-primary data-[disabled]:opacity-50"
              >
                <SelectPrimitive.ItemText>
                  {option.props.children}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2">
                  <Check size={16} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex justify-center py-1">
            <ChevronDown size={16} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
