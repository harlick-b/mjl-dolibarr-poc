import { useCallback, useState } from 'react'

export function useScopedPagination(scope, initialValue) {
  const [state, setState] = useState(() => ({
    scope,
    value: initialValue,
  }))
  if (state.scope !== scope) setState({ scope, value: initialValue })
  const value = state.scope === scope ? state.value : initialValue
  const setValue = useCallback(
    (nextValue) => {
      setState((current) => ({
        scope,
        value:
          typeof nextValue === 'function'
            ? nextValue(current.scope === scope ? current.value : initialValue)
            : nextValue,
      }))
    },
    [initialValue, scope],
  )
  return [value, setValue]
}
