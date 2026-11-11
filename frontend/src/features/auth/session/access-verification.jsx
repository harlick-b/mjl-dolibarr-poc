/* eslint-disable react-refresh/only-export-components -- coordinator and hooks share one access context contract. */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react'
import { authorization, isKnownRole } from './authorization'
import { ApiError } from '@/shared/api/rest-client'

const SESSION_KEY = ['auth', 'session']
const LOGOUT_HOLD_KEY = 'mjl.logout-pending'
const AUTH_SOURCE = crypto.randomUUID()

function logoutHoldStored() {
  try {
    const value = globalThis.sessionStorage.getItem(LOGOUT_HOLD_KEY)
    return value === 'login' ? 'login' : value === 'true'
  } catch {
    return false
  }
}

function storeLogoutHold(held) {
  try {
    if (held)
      globalThis.sessionStorage.setItem(
        LOGOUT_HOLD_KEY,
        held === 'login' ? 'login' : 'true',
      )
    else globalThis.sessionStorage.removeItem(LOGOUT_HOLD_KEY)
  } catch {
    /* A blocked storage API does not weaken the current in-memory hold. */
  }
}

export function broadcastAuthenticationChange() {
  const channel = new BroadcastChannel('mjl-auth')
  channel.postMessage({ type: 'changed', source: AUTH_SOURCE })
  channel.close()
}

export function isLocalAuthenticationChange(event) {
  return event.data?.source === AUTH_SOURCE
}

function validateSession(value) {
  const nonEmpty = (field) =>
    typeof field === 'string' && field.trim().length > 0
  if (!value || typeof value !== 'object' || !nonEmpty(value.csrf))
    throw new ApiError('Réponse de session invalide.', { kind: 'malformed' })
  if (value.state === 'anonymous') return value
  if (value.state === 'pending') {
    if (!nonEmpty(value.email))
      throw new ApiError('Réponse de session invalide.', { kind: 'malformed' })
    return value
  }
  const expires = Date.parse(value.expires_at)
  if (
    value.state !== 'verified' ||
    !value.user ||
    !nonEmpty(value.user.id) ||
    !nonEmpty(value.user.email) ||
    !isKnownRole(value.user.role) ||
    !Number.isFinite(expires) ||
    expires <= Date.now()
  )
    throw new ApiError('Réponse de session invalide.', { kind: 'malformed' })
  return value
}

export function createAccessCoordinator({
  queryClient,
  readSession,
  timeoutMs = 10_000,
}) {
  let logoutHeld = logoutHoldStored()
  let snapshot = {
    status: logoutHeld ? 'blocked' : 'unknown',
    session: null,
    reason:
      logoutHeld === 'login'
        ? 'service-unavailable'
        : logoutHeld
          ? 'logout'
          : null,
    generation: 0,
    logoutCsrf: null,
    identityVersion: 0,
  }
  let inFlight = null
  let verificationController = null
  let expiryTimer
  let deniedPath = null
  let recoveryConsumed = false
  let authenticationChanged = false
  let logoutPreparation = null
  let lastVerifiedIdentity = null
  let lastAuthenticationChange = 0
  const listeners = new Set()
  const cleanups = new Set()

  const publish = (next) => {
    snapshot = { ...snapshot, ...next }
    for (const listener of listeners) listener()
  }

  const purge = ({ removeSession = false } = {}) => {
    clearTimeout(expiryTimer)
    for (const cleanup of cleanups) cleanup()
    const cancellation = queryClient.cancelQueries()
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'auth',
    })
    if (removeSession) queryClient.setQueryData(SESSION_KEY, null)
    queryClient.getMutationCache().clear()
    return cancellation
  }

  const mask = (reason) => {
    verificationController?.abort()
    purge({ removeSession: true })
    publish({
      status: 'blocked',
      session: null,
      reason,
      generation: snapshot.generation + 1,
    })
  }

  const scheduleExpiry = (session) => {
    clearTimeout(expiryTimer)
    if (session.state !== 'verified') return
    expiryTimer = setTimeout(
      () => {
        mask('expired')
        void verify({ reason: 'expired' }).catch(() => null)
      },
      Math.max(0, Date.parse(session.expires_at) - Date.now()),
    )
  }

  const verify = ({ manual = false, reason = 'verification' } = {}) => {
    if (inFlight) return inFlight
    if (logoutHeld)
      return Promise.reject(
        new ApiError('Déconnexion à confirmer.', { kind: 'logout_pending' }),
      )
    if (!navigator.onLine) {
      mask('offline')
      return Promise.reject(
        new ApiError('Connexion indisponible.', { kind: 'offline' }),
      )
    }
    if (manual) recoveryConsumed = false
    const generation = snapshot.generation + 1
    const cancellation = purge()
    publish({ status: 'checking', session: null, reason, generation })
    const controller = new AbortController()
    verificationController = controller
    let rejectDeadline
    let deadlineError = null
    const deadline = new Promise((_, reject) => {
      rejectDeadline = reject
    })
    const timeout = setTimeout(() => {
      controller.abort()
      deadlineError = new ApiError('La vérification de session a expiré.', {
        kind: 'timeout',
      })
      rejectDeadline(deadlineError)
    }, timeoutMs)
    let reads = 0
    const read = () => {
      if (deadlineError) return Promise.reject(deadlineError)
      reads += 1
      return Promise.race([
        readSession({ signal: controller.signal }),
        deadline,
      ])
    }
    const readFinalContext = async () => {
      try {
        return await read()
      } catch (error) {
        if (error?.status !== 401) throw error
        const failed = new ApiError(error.message, {
          status: error.status,
          code: error.code,
          kind: error.kind,
        })
        failed.authenticationFailed = true
        throw failed
      }
    }
    const run = async () => {
      // Do not reopen the protected tree while cancellation from the previous
      // access generation can still reach newly mounted queries.
      await cancellation
      let session
      let authenticationFailed = false
      try {
        session = await read()
      } catch (error) {
        if (error?.status === 401) {
          authenticationFailed = true
          authenticationChanged = false
          try {
            session = await readFinalContext()
          } catch (bootstrapError) {
            bootstrapError.authenticationFailed = true
            throw bootstrapError
          }
        } else if (authenticationChanged && reads < 2 && !deadlineError) {
          authenticationChanged = false
          session = await readFinalContext()
        } else {
          authenticationChanged = false
          throw error
        }
      }
      if (authenticationChanged && reads < 2) {
        authenticationChanged = false
        session = await readFinalContext()
      }
      if (authenticationChanged && reads >= 2) {
        authenticationChanged = false
        throw new ApiError('Le contexte d’authentification a changé.', {
          kind: 'authentication_changed',
        })
      }
      if (generation !== snapshot.generation)
        throw new DOMException('Stale access verification', 'AbortError')
      try {
        session = validateSession(session)
      } catch (error) {
        if (authenticationFailed) error.authenticationFailed = true
        throw error
      }
      const identity =
        session.state === 'verified'
          ? `${session.user.id}:${session.user.role}`
          : null
      const identityChanged =
        identity && lastVerifiedIdentity && identity !== lastVerifiedIdentity
      if (identity) lastVerifiedIdentity = identity
      queryClient.setQueryData(SESSION_KEY, session)
      publish({
        status: session.state,
        session,
        reason: null,
        identityVersion: identityChanged
          ? snapshot.identityVersion + 1
          : snapshot.identityVersion,
      })
      scheduleExpiry(session)
      return session
    }
    inFlight = run()
      .catch((error) => {
        if (generation === snapshot.generation) {
          if (
            error?.status >= 500 ||
            ['network', 'timeout'].includes(error?.kind)
          ) {
            logoutHeld = 'login'
            storeLogoutHold('login')
            mask('service-unavailable')
            throw error
          }
          const status =
            error?.status === 401 || error?.authenticationFailed
              ? 'anonymous'
              : 'blocked'
          publish({ status, session: null, reason: error })
        }
        throw error
      })
      .finally(() => {
        clearTimeout(timeout)
        if (verificationController === controller) verificationController = null
        inFlight = null
      })
    return inFlight
  }

  const uncertain = (path) => {
    deniedPath = path
    if (inFlight) return inFlight
    mask('authorization')
    if (recoveryConsumed) return Promise.resolve(null)
    recoveryConsumed = true
    return verify({ reason: 'authorization' }).catch(() => null)
  }

  return {
    getSnapshot: () => snapshot,
    updateDisplayName(userId, fullName) {
      if (
        snapshot.status !== 'verified' ||
        snapshot.session?.user.id !== userId
      )
        return
      const session = {
        ...snapshot.session,
        user: { ...snapshot.session.user, full_name: fullName },
      }
      queryClient.setQueryData(SESSION_KEY, session)
      publish({ session })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    registerCleanup(cleanup) {
      cleanups.add(cleanup)
      return () => cleanups.delete(cleanup)
    },
    verify,
    holdUnavailable() {
      logoutHeld = 'login'
      storeLogoutHold('login')
      mask('service-unavailable')
    },
    holdLogout(csrf) {
      logoutHeld = true
      storeLogoutHold(true)
      mask('logout')
      publish({ logoutCsrf: csrf })
    },
    releaseLogout() {
      logoutHeld = false
      storeLogoutHold(false)
      recoveryConsumed = false
      publish({ logoutCsrf: null })
    },
    prepareLogout() {
      if (!logoutHeld)
        return Promise.reject(
          new ApiError('Aucune déconnexion à confirmer.', {
            kind: 'logout_not_pending',
          }),
        )
      if (logoutPreparation) return logoutPreparation
      const controller = new AbortController()
      let rejectDeadline
      const deadline = new Promise((_, reject) => {
        rejectDeadline = reject
      })
      const timeout = setTimeout(() => {
        controller.abort()
        rejectDeadline(
          new ApiError('La préparation de la déconnexion a expiré.', {
            kind: 'timeout',
          }),
        )
      }, timeoutMs)
      const read = () =>
        Promise.race([readSession({ signal: controller.signal }), deadline])
      logoutPreparation = (async () => {
        let session
        try {
          session = await read()
        } catch (error) {
          if (error?.status !== 401) throw error
          session = await read()
        }
        return validateSession(session).csrf
      })().finally(() => {
        clearTimeout(timeout)
        logoutPreparation = null
      })
      return logoutPreparation
    },
    uncertain,
    requestFailed(path, error) {
      if (error?.status === 401 || error?.code === 'csrf_invalid')
        return uncertain(path)
      return null
    },
    requestSucceeded(path) {
      if (deniedPath === path) {
        deniedPath = null
        recoveryConsumed = false
      }
    },
    show() {
      const canResume = () =>
        snapshot.status === 'blocked' &&
        snapshot.reason === 'offline' &&
        navigator.onLine
      if (!canResume()) return Promise.resolve(snapshot.session)
      const resume = () =>
        canResume()
          ? verify({ reason: 'visible' }).catch(() => null)
          : Promise.resolve(snapshot.session)
      return inFlight ? inFlight.catch(() => null).then(resume) : resume()
    },
    changed() {
      if (logoutHeld) return Promise.resolve(null)
      const now = Date.now()
      if (now - lastAuthenticationChange < 500) return Promise.resolve(null)
      lastAuthenticationChange = now
      recoveryConsumed = false
      if (inFlight) {
        authenticationChanged = true
        purge({ removeSession: true })
        publish({ status: 'checking', session: null, reason: 'changed' })
        return inFlight.catch(() => null)
      }
      authenticationChanged = false
      mask('changed')
      return verify({ reason: 'changed' }).catch(() => null)
    },
    offline() {
      if (snapshot.status === 'verified' || snapshot.status === 'checking')
        mask('offline')
    },
    dispose() {
      snapshot = { ...snapshot, generation: snapshot.generation + 1 }
      verificationController?.abort()
      clearTimeout(expiryTimer)
      purge()
      listeners.clear()
      cleanups.clear()
    },
  }
}

const AccessContext = createContext(null)

export function AccessProvider({ coordinator, children }) {
  const lifecycle = useRef(0)
  useEffect(() => {
    const generation = ++lifecycle.current
    const channel = new BroadcastChannel('mjl-auth')
    const offline = () => coordinator.offline()
    const online = () => void coordinator.show()
    channel.onmessage = (event) => {
      if (!isLocalAuthenticationChange(event)) void coordinator.changed()
    }
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => {
      channel.close()
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', online)
      // StrictMode remounts effects immediately; dispose only a departed provider.
      queueMicrotask(() => {
        if (lifecycle.current === generation) coordinator.dispose()
      })
    }
  }, [coordinator])
  return (
    <AccessContext.Provider value={coordinator}>
      {children}
    </AccessContext.Provider>
  )
}

export function useAccess() {
  const coordinator = useContext(AccessContext)
  if (!coordinator)
    throw new Error('useAccess must be used inside AccessProvider')
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  )
  return {
    ...state,
    ...authorization(state.session),
    verify: coordinator.verify,
    updateDisplayName: coordinator.updateDisplayName,
    holdLogout: coordinator.holdLogout,
    releaseLogout: coordinator.releaseLogout,
    prepareLogout: coordinator.prepareLogout,
    holdUnavailable: coordinator.holdUnavailable,
  }
}

export function useProtectedCleanup(cleanup) {
  const coordinator = useContext(AccessContext)
  useEffect(() => coordinator?.registerCleanup(cleanup), [cleanup, coordinator])
}
