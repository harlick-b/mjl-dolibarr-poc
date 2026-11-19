import { api } from '@/shared/api/rest-client'

export const sessionKey = ['auth', 'session']

export const sessionQuery = {
  queryKey: sessionKey,
  queryFn: () => api.verifyAccess({ manual: true }),
  enabled: false,
  retry: false,
  staleTime: 0,
  gcTime: 0,
  networkMode: 'always',
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
}
