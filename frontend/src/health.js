import { queryOptions } from '@tanstack/react-query'

export const healthQuery = queryOptions({
  queryKey: ['health', 'ready'],
  async queryFn({ signal }) {
    let response
    try {
      response = await fetch('/api/health/ready', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        cache: 'no-store',
      })
    } catch (error) {
      if (signal.aborted) throw error
      throw new Error('unavailable', { cause: error })
    }
    if (response.status === 503) throw new Error('unavailable')
    if (!response.ok) throw new Error('request')
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error('request')
    }
    if (body.status !== 'ok') throw new Error('request')
    return body
  },
  networkMode: 'always',
  retry: false,
  retryOnMount: false,
  staleTime: 0,
  gcTime: 0,
  refetchInterval: 10000,
})
