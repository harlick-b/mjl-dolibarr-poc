import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useScopedPagination } from './useScopedPagination'

test('drops local pagination when its list scope changes', () => {
  const { result, rerender } = renderHook(
    ({ scope }) => useScopedPagination(scope, ''),
    { initialProps: { scope: 'state=submitted' } },
  )

  act(() => result.current[1]('next-page'))
  expect(result.current[0]).toBe('next-page')

  rerender({ scope: 'state=approved' })
  expect(result.current[0]).toBe('')

  rerender({ scope: 'state=submitted' })
  expect(result.current[0]).toBe('')

  act(() => result.current[1]((current) => `${current}fresh-page`))
  expect(result.current[0]).toBe('fresh-page')
})
