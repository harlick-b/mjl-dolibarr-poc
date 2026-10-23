import { queryOptions } from '@tanstack/react-query'
import { api } from './rest-client'

export const healthQuery = queryOptions({
  queryKey: ['health', 'ready'],
  async queryFn({ signal }) {
    let body
    try {
      body = await api.request('/api/health/ready', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      })
    } catch (error) {
      if (signal.aborted) throw error
      throw new Error(
        error.status === 503 || ['network', 'offline'].includes(error.kind)
          ? 'unavailable'
          : 'request',
        { cause: error },
      )
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
