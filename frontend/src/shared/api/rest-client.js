export class ApiError extends Error {
  constructor(message, { status, code, fields, kind = 'http', retryAt } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.kind = kind
    this.retryAt = retryAt
  }
}

function messageFor(status) {
  if (status === 429) return 'Trop de tentatives. Veuillez patienter.'
  if (status === 503) return 'Service indisponible. Réessayez plus tard.'
  return 'Vérification refusée. Vérifiez les informations saisies.'
}

export class RestClient {
  access = null
  limitedUntil = new Map()

  configureAccess(coordinator) {
    this.access = coordinator
  }

  verifyAccess(options) {
    if (!this.access) throw new Error('Access coordinator is not configured')
    return this.access.verify(options)
  }

  async request(
    path,
    {
      signal,
      csrf,
      body,
      rawBody,
      headers = {},
      method,
      responseType = 'json',
      access = 'protected',
    } = {},
  ) {
    if (typeof path !== 'string' || !path.startsWith('/api/'))
      throw new ApiError('Requête refusée.', {
        code: 'untrusted_api_url',
        kind: 'request',
      })
    const limitedUntil = this.limitedUntil.get(path)
    if (limitedUntil && limitedUntil > Date.now())
      throw new ApiError(messageFor(429), {
        status: 429,
        kind: 'rate_limit',
        retryAt: limitedUntil,
      })
    this.limitedUntil.delete(path)
    if (!navigator.onLine)
      throw new ApiError('Connexion indisponible. Aucune action envoyée.', {
        kind: 'offline',
      })
    const accessCoordinator = this.access
    const generation = accessCoordinator?.getSnapshot().generation
    const protectedController =
      access === 'protected' ? new AbortController() : null
    const abortFromCaller = () => protectedController?.abort(signal?.reason)
    if (protectedController && signal?.aborted) abortFromCaller()
    else signal?.addEventListener('abort', abortFromCaller, { once: true })
    const unregisterCleanup = protectedController
      ? accessCoordinator?.registerCleanup(() => protectedController.abort())
      : null
    const requestSignal = protectedController?.signal ?? signal
    const checkGeneration = () => {
      if (
        access === 'protected' &&
        generation !== undefined &&
        generation !== accessCoordinator?.getSnapshot().generation
      )
        throw new DOMException('Stale authorization', 'AbortError')
    }
    try {
      let response
      try {
        response = await fetch(path, {
          method: method ?? (body === undefined ? 'GET' : 'POST'),
          credentials: 'same-origin',
          cache: 'no-store',
          signal: requestSignal,
          headers:
            body === undefined
              ? {
                  ...headers,
                  ...(rawBody === undefined ? {} : { 'X-CSRF-Token': csrf }),
                }
              : {
                  ...headers,
                  'Content-Type': 'application/json',
                  'X-CSRF-Token': csrf,
                },
          body: body === undefined ? rawBody : JSON.stringify(body),
        })
      } catch (error) {
        if (error?.name === 'AbortError') throw error
        throw new ApiError('Service indisponible. Réessayez plus tard.', {
          kind: 'network',
        })
      }
      if (!response.ok) {
        checkGeneration()
        // Authentication is already uncertain from the status alone. An error
        // body must never delay masking or the bounded session check.
        if (access === 'protected' && response.status === 401) {
          const error = new ApiError(messageFor(401), { status: 401 })
          accessCoordinator?.requestFailed(path, error)
          throw error
        }
        const payload = await response.json().catch(() => ({}))
        checkGeneration()
        const retryHeader = response.headers?.get('Retry-After')
        const retrySeconds = Number(retryHeader)
        const retryAt = retryHeader
          ? Number.isFinite(retrySeconds)
            ? Date.now() + Math.max(0, retrySeconds * 1000)
            : Date.parse(retryHeader)
          : undefined
        if (response.status === 429 && Number.isFinite(retryAt))
          this.limitedUntil.set(path, retryAt)
        const error = new ApiError(messageFor(response.status), {
          status: response.status,
          code: payload.code,
          fields: payload.fields,
          retryAt: Number.isFinite(retryAt) ? retryAt : undefined,
        })
        if (access === 'protected')
          accessCoordinator?.requestFailed(path, error)
        throw error
      }
      if (response.status === 204) {
        checkGeneration()
        if (access === 'protected') accessCoordinator?.requestSucceeded(path)
        return null
      }
      if (responseType === 'blob') {
        const disposition = response.headers.get('Content-Disposition') || ''
        const match = disposition.match(/filename="([A-Za-z0-9._-]{1,200})"/)
        const result = {
          blob: await response.blob(),
          filename: match?.[1] || 'telechargement.csv',
        }
        checkGeneration()
        if (access === 'protected') accessCoordinator?.requestSucceeded(path)
        return result
      }
      let result
      try {
        result = await response.json()
      } catch (error) {
        if (error?.name === 'AbortError') throw error
        throw new ApiError('Réponse du service invalide.', {
          kind: 'malformed',
        })
      }
      checkGeneration()
      if (access === 'protected') accessCoordinator?.requestSucceeded(path)
      return result
    } finally {
      signal?.removeEventListener('abort', abortFromCaller)
      unregisterCleanup?.()
    }
  }

  auth(path, options) {
    return this.request(`/api/v1/auth/${path}`, {
      ...options,
      access: path === 'session' ? 'session' : 'public',
    })
  }

  download(path, options) {
    return this.request(path, { ...options, responseType: 'blob' })
  }
}

export const api = new RestClient()
