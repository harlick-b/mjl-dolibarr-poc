import { useEffect, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { formatDate } from '@/shared/lib/format'
import { Button } from './button'
import { QueryFilterSelect } from './QueryFilterSelect'
import { DatePicker } from './DatePicker'
import { strings } from '@/locales/fr/ListFilters'
import { strings as common } from '@/locales/fr/common'

function DebouncedActivitySearch({ value, label, disabled, onChange }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    if (draft === value) return
    const timer = window.setTimeout(() => onChange(draft), 350)
    return () => window.clearTimeout(timer)
  }, [draft, onChange, value])
  return (
    <label className="relative min-w-64 max-w-140 flex-1">
      <span className="sr-only">{label}</span>
      <Search
        size={16}
        className="absolute left-3 top-3 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={label}
        disabled={disabled}
        maxLength={200}
        className="h-10 w-full rounded-control border border-strong-border bg-white py-2 pl-10 pr-3 text-sm disabled:bg-background"
      />
    </label>
  )
}

export function ActivityExplorerFilters({
  value = {},
  onChange,
  agentPath,
  ownActivities = false,
  reviewLabel = '',
  searchLabel = strings.searchActivity,
  stateLabel = strings.state,
  stateOptions,
  filterStates,
  quickStates,
  dates = false,
  disabled = false,
}) {
  const [agentLabel, setAgentLabel] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const reset = () => {
    onChange({
      q: '',
      state: '',
      ...(reviewLabel ? { review: 'all' } : {}),
      agent: '',
      ...(ownActivities ? { mine: 'all' } : {}),
      ...(dates ? { from: '', to: '' } : {}),
    })
  }
  const chips = [
    ['review', value.review === 'mine' ? 'mine' : '', reviewLabel],
    ['q', value.q, `${strings.search}: ${value.q}`],
    [
      'state',
      value.state,
      stateOptions.find((option) => option.value === value.state)?.label ||
        value.state,
    ],
    ['agent', value.agent, agentLabel || strings.selectedAgent],
    [
      'from',
      value.from,
      value.from ? `${strings.from}: ${formatDate(value.from)}` : '',
    ],
    ['to', value.to, value.to ? `${strings.to}: ${formatDate(value.to)}` : ''],
  ].filter(([, raw]) => raw)
  const states = filterStates || stateOptions.filter((option) => option.value)

  return (
    <div className="border-b border-border bg-background/40">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <DebouncedActivitySearch
          key={value.q || ''}
          value={value.q || ''}
          label={searchLabel}
          disabled={disabled}
          onChange={(q) => onChange({ q })}
        />
        <Popover.Root open={filterOpen} onOpenChange={setFilterOpen}>
          <Popover.Trigger asChild>
            <Button type="button" variant="outline" disabled={disabled}>
              <SlidersHorizontal size={16} aria-hidden="true" />
              {strings.filters}
            </Button>
          </Popover.Trigger>
          <Popover.Portal forceMount>
            <Popover.Content
              forceMount
              hidden={!filterOpen}
              align="end"
              sideOffset={6}
              className={`${filterOpen ? 'grid' : 'hidden'} z-50 w-[min(300px,calc(100vw-24px))] gap-5 rounded-panel border border-border bg-white p-4 shadow-lg`}
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm font-semibold">
                  {strings.refineResults}
                </strong>
                <Popover.Close asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="size-8 min-h-8 p-0"
                    aria-label={common.dismiss}
                  >
                    <X size={17} aria-hidden="true" />
                  </Button>
                </Popover.Close>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-xs text-muted-foreground">
                  {stateLabel}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {states.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-pressed={value.state === option.value}
                      className="bg-background aria-pressed:bg-selected aria-pressed:text-primary"
                      onClick={() =>
                        onChange({
                          state:
                            value.state === option.value ? '' : option.value,
                          ...(reviewLabel ? { review: 'all' } : {}),
                        })
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </fieldset>
              {agentPath && !ownActivities && (
                <QueryFilterSelect
                  kind="agent"
                  path={agentPath}
                  value={value.agent || ''}
                  valueLabel={agentLabel}
                  onResolvedLabel={setAgentLabel}
                  onChange={(agent, label = '') => {
                    setAgentLabel(label)
                    onChange({ agent })
                  }}
                  searchable
                  compact
                />
              )}
              {dates && (
                <fieldset className="grid gap-3">
                  <legend className="mb-1 text-xs text-muted-foreground">
                    {strings.activityPeriod}
                  </legend>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="grid gap-2">
                      <span>{strings.from}</span>
                      <DatePicker
                        label={strings.from}
                        value={value.from || ''}
                        onChange={(from) => onChange({ from })}
                        optional
                      />
                    </div>
                    <div className="grid gap-2">
                      <span>{strings.to}</span>
                      <DatePicker
                        label={strings.to}
                        value={value.to || ''}
                        onChange={(to) => onChange({ to })}
                        optional
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {strings.overlappingDates}
                  </p>
                </fieldset>
              )}
              <Popover.Close asChild>
                <Button type="button" variant="outline" className="w-fit">
                  {strings.showResults}
                </Button>
              </Popover.Close>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <div className="flex flex-wrap gap-1 px-4 py-3" aria-label={stateLabel}>
        {quickStates.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={value.state === option.value}
            className="aria-pressed:bg-selected aria-pressed:text-primary"
            onClick={() =>
              onChange({
                state: option.value,
                ...(reviewLabel ? { review: 'all' } : {}),
              })
            }
          >
            {option.label}
          </Button>
        ))}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
          {chips.map(([key, , label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onChange(
                  key === 'review'
                    ? { review: 'all', state: '' }
                    : { [key]: '' },
                )
              }
              aria-label={
                key === 'review'
                  ? `Retirer le filtre ${label}`
                  : `${strings.removeFilter} ${key === 'state' ? stateLabel : key === 'agent' ? strings.agent : label}`
              }
            >
              {label} ×
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={reset}>
            {strings.reset}
          </Button>
        </div>
      )}
    </div>
  )
}
