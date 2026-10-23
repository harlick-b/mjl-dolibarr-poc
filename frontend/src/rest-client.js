export class ApiError extends Error {
  constructor(
    message,
    { status, code, fields, requestId, kind = 'http' } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.requestId = requestId
    this.kind = kind
  }
}

function messageFor(status) {
  if (status === 429) return 'Trop de tentatives. Veuillez patienter.'
  if (status === 503) return 'Service indisponible. Réessayez plus tard.'
  return 'Vérification refusée. Vérifiez les informations saisies.'
}

export class RestClient {
  async request(path, { signal, csrf, body, method } = {}) {
    if (!navigator.onLine)
      throw new ApiError('Connexion indisponible. Aucune action envoyée.', {
        kind: 'offline',
      })
    let response
    try {
      response = await fetch(path, {
        method: method ?? (body === undefined ? 'GET' : 'POST'),
        credentials: 'same-origin',
        cache: 'no-store',
        signal,
        headers:
          body === undefined
            ? {}
            : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      throw new ApiError('Service indisponible. Réessayez plus tard.', {
        kind: 'network',
      })
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new ApiError(messageFor(response.status), {
        status: response.status,
        code: payload.code,
        fields: payload.fields,
        requestId: payload.request_id,
      })
    }
    if (response.status === 204) return null
    try {
      return await response.json()
    } catch {
      throw new ApiError('Réponse du service invalide.', { kind: 'malformed' })
    }
  }

  auth(path, options) {
    return this.request(`/api/v1/auth/${path}`, options)
  }
}

export const api = new RestClient()
