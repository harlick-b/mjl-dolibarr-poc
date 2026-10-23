import { api } from './rest-client'

export const sessionKey = ['auth', 'session']

export const apiRequest = (path, options) => api.request(path, options)

export const sessionQuery = {
  queryKey: sessionKey,
  queryFn: ({ signal }) => authRequest('session', { signal }),
  retry: false,
  staleTime: 0,
  gcTime: 0,
  networkMode: 'always',
}

export function authRequest(path, options) {
  return api.auth(path, options)
}

export const roleLabels = {
  ADMIN_PLATEFORME: 'Admin technique',
  AGENT_SAISIE: 'Agent de saisie',
  AGENT_VERIFICATEUR: 'Agent superviseur et prévalidateur',
  VALIDATEUR_DEFINITIF: 'Validateur définitif',
}
