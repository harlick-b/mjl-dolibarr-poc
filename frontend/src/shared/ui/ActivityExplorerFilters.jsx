import { useState } from 'react'
import { formatDate } from '@/shared/lib/format'
import { Button } from './button'
import { ListFilters } from './ListFilters'
import { QueryFilterSelect } from './QueryFilterSelect'
import { Select } from './select'
import { strings } from '@/locales/fr/ListFilters'

export function ActivityExplorerFilters({
  value = {},
  onChange,
  agentPath,
  ownActivities = false,
  reviewLabel = '',
  searchLabel = strings.searchActivity,
  stateLabel = strings.state,
  stateOptions,
  quickStates,
  dates = false,
  disabled = false,
}) {
  const [agentLabel, setAgentLabel] = useState('')
  const reset = () =>
    onChange({
      q: '',
      state: '',
      ...(reviewLabel ? { review: 'all' } : {}),
      agent: '',
      ...(ownActivities ? { mine: 'all' } : {}),
      ...(dates ? { from: '', to: '' } : {}),
    })
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

  return (
    <div className="border-b border-border bg-background/40">
      <ListFilters
        value={value.q || ''}
        onSearch={(q) => onChange({ q })}
        label={searchLabel}
        onReset={reset}
        disabled={disabled}
        keepMounted={Boolean(value.agent)}
        toolbar={
          ownActivities ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={value.mine !== 'all'}
              className="aria-pressed:bg-selected aria-pressed:text-primary"
              onClick={() =>
                onChange({ mine: value.mine === 'all' ? 'own' : 'all' })
              }
            >
              {strings.myActivities}
            </Button>
          ) : null
        }
      >
        <label>
          {stateLabel}
          <Select
            value={value.state || ''}
            onChange={(event) =>
              onChange({
                state: event.target.value,
                ...(reviewLabel ? { review: 'all' } : {}),
              })
            }
          >
            {stateOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
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
          />
        )}
        {dates && (
          <>
            <label>
              {strings.from}
              <input
                type="date"
                value={value.from || ''}
                onChange={(event) => onChange({ from: event.target.value })}
              />
            </label>
            <label>
              {strings.to}
              <input
                type="date"
                value={value.to || ''}
                onChange={(event) => onChange({ to: event.target.value })}
              />
            </label>
          </>
        )}
      </ListFilters>
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
