export const sessionKey = ['auth', 'session']

export async function authRequest(path, { signal, csrf, body } = {}) {
  if (!navigator.onLine)
    throw new Error('Connexion indisponible. Aucune action envoyée.')
  const response = await fetch(`/api/v1/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    headers:
      body === undefined
        ? {}
        : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const error = new Error(
      response.status === 429
        ? 'Trop de tentatives. Veuillez patienter.'
        : response.status === 503
          ? 'Service indisponible. Réessayez plus tard.'
          : 'Vérification refusée. Vérifiez les informations saisies.',
    )
    error.status = response.status
    throw error
  }
  return response.status === 204 ? null : response.json()
}

export const sessionQuery = {
  queryKey: sessionKey,
  queryFn: ({ signal }) => authRequest('session', { signal }),
  retry: false,
  staleTime: 0,
  gcTime: 0,
  networkMode: 'always',
}
