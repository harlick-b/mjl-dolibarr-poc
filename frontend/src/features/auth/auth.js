import { api } from '@/shared/api/rest-client'

export const sessionKey = ['auth', 'session']

export const apiRequest = (path, options) => api.request(path, options)

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

export function authRequest(path, options) {
  return api.auth(path, options)
}
