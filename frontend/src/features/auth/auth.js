import { api } from '@/shared/api/rest-client'

export const sessionKey = ['auth', 'session']

export const apiRequest = (path, options) => api.request(path, options)

export const sessionQuery = {
  queryKey: sessionKey,
  queryFn: async ({ signal }) => {
    try {
      return await authRequest('session', { signal })
    } catch (error) {
      // An expired cookie is cleared by the server. Read a fresh anonymous context.
      if (error.status !== 401) throw error
      return authRequest('session', { signal })
    }
  },
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
  PARTENAIRE: 'Partenaire',
}

export function workspacePath(role) {
  if (role === 'ADMIN_PLATEFORME') return '/access/users'
  if (role === 'PARTENAIRE') return '/partner'
  return '/projects'
}
