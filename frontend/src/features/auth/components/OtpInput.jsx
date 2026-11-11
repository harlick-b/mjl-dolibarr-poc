import { useEffect, useRef } from 'react'
import { strings } from '@/locales/fr/OtpInput'

export function OtpInput({ value, onChange, onComplete, disabled }) {
  const inputs = useRef([])
  useEffect(() => {
    if (!disabled && !value) inputs.current[0]?.focus()
  }, [disabled, value])
  function insert(index, text) {
    const digits = text.replace(/\D/g, '').slice(0, 6)
    if (!digits) return
    const start = digits.length === 6 ? 0 : index
    const next = value.padEnd(6, ' ').split('')
    for (let offset = 0; offset < digits.length && start + offset < 6; offset++)
      next[start + offset] = digits[offset]
    const code = next.join('').trimEnd()
    onChange(code)
    inputs.current[Math.min(start + digits.length, 5)]?.focus()
    if (/^[0-9]{6}$/.test(code)) onComplete?.(code)
  }
  function clear(index) {
    const next = value.padEnd(6, ' ').split('')
    next[index] = ' '
    onChange(next.join('').trimEnd())
  }
  return (
    <fieldset
      className="[&_legend]:grid [&_legend]:gap-2 [&_legend]:text-[0.8125rem] [&_legend]:leading-5 [&_legend]:font-medium [&_legend]:mb-2 min-w-0"
      disabled={disabled}
    >
      <legend>{strings.otpLabel} *</legend>
      <div
        className="grid grid-cols-[repeat(3,_minmax(0,_1fr))_8px_repeat(3,_minmax(0,_1fr))] gap-2 mx-auto max-w-90 [&_input]:h-12 [&_input]:p-1 [&_input]:text-center [&_input]:text-2xl [&_input]:leading-8 [&_:where(input:nth-child(4))]:col-start-5 max-[761px]:gap-1"
        data-ui="auth-otp-slots"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(node) => {
              inputs.current[index] = node
            }}
            aria-label={
              index === 0
                ? strings.otpLabel
                : strings.formatString(strings.otpDigit, {
                    position: index + 1,
                  })
            }
            name={`otp-${index + 1}`}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            pattern="[0-9]"
            required
            value={value[index]?.trim() || ''}
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              if (!event.target.value) clear(index)
              else insert(index, event.target.value)
            }}
            onPaste={(event) => {
              event.preventDefault()
              insert(index, event.clipboardData.getData('text'))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault()
                const target = value[index]?.trim()
                  ? index
                  : Math.max(0, index - 1)
                clear(target)
                inputs.current[target]?.focus()
              } else if (
                event.key === 'ArrowLeft' ||
                event.key === 'ArrowRight'
              ) {
                event.preventDefault()
                inputs.current[
                  Math.max(
                    0,
                    Math.min(5, index + (event.key === 'ArrowLeft' ? -1 : 1)),
                  )
                ]?.focus()
              }
            }}
          />
        ))}
      </div>
    </fieldset>
  )
}
