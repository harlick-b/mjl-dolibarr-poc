import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Link,
  Navigate,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { sessionKey, sessionQuery, roleLabels, workspacePath } from './auth'
import { useAPI } from '@/shared/api/RestClientProvider'
import { Helmet } from 'react-helmet-async'
import { strings } from '@/shared/i18n'
import { OtpInput } from './OtpInput'
import { AdminSidebar } from '@/features/access/AdminSidebar'

function subscribeOnline(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function Password({ label, name, value, onChange, disabled }) {
  const [visible, setVisible] = useState(false)
  return (
    <label>
      {label}
      <span className="auth-password">
        <input
          name={name}
          disabled={disabled}
          value={value}
          onChange={onChange}
          type={visible ? 'text' : 'password'}
          autoComplete={
            name === 'loginPassword' ? 'current-password' : 'new-password'
          }
          required
          maxLength={128}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={
            visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
          }
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  )
}

export function AuthView() {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const loader = useRouterState({
    select: (state) => state.matches.at(-1)?.loaderData,
  })
  const navigate = useNavigate()
  const router = useRouter()
  const client = useQueryClient()
  const { api } = useAPI()
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine)
  const session = useQuery(sessionQuery)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [revalidation, setRevalidation] = useState(0)
  const logoutPending = useRef(false)
  const [logoutUnconfirmed, setLogoutUnconfirmed] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [recoveryDone, setRecoveryDone] = useState(false)
  const generation = useRef(0)
  const channel = useRef(null)
  const controller = useRef(null)
  const inFlight = useRef(null)
  const dirty = Boolean(email || password || confirmation || code)
  const mutation = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: ({ endpoint, body, csrf, signal }) =>
      api.auth(endpoint, { body, csrf, signal }),
    meta: { localError: true },
  })
  const resetMutation = mutation.reset
  const expiry = session.data?.expires_at

  useEffect(() => {
    const invalidate = () => {
      setRevalidation((version) => version + 1)
      setPassword('')
      setConfirmation('')
      setCode('')
      setEmail('')
      if (logoutPending.current)
        setNotice(
          'Déconnexion non confirmée. Réessayez une fois la connexion rétablie.',
        )
      resetMutation()
      generation.current += 1
      inFlight.current = null
      controller.current?.abort()
      void client.cancelQueries()
      client.clear()
      void router.invalidate()
    }
    const broadcast = new BroadcastChannel('mjl-auth')
    channel.current = broadcast
    broadcast.onmessage = invalidate
    window.addEventListener('offline', invalidate)
    return () => {
      generation.current += 1
      inFlight.current = null
      controller.current?.abort()
      resetMutation()
      client.getMutationCache().clear()
      broadcast.close()
      window.removeEventListener('offline', invalidate)
    }
  }, [client, resetMutation, router])

  const refetchSession = session.refetch
  useEffect(() => {
    if (!revalidation || !online || logoutUnconfirmed) return
    const current = generation.current
    let cancelled = false
    void refetchSession().then((fresh) => {
      if (!cancelled && current === generation.current && !fresh.isError)
        setRevalidation(0)
    })
    return () => {
      cancelled = true
    }
  }, [revalidation, online, logoutUnconfirmed, refetchSession])

  useEffect(() => {
    if (!expiry) return
    const timer = window.setTimeout(
      () => {
        setRevalidation((version) => version + 1)
        generation.current += 1
        void client.cancelQueries()
        client.clear()
        void client.invalidateQueries({ queryKey: sessionKey })
      },
      Math.max(0, Date.parse(expiry) - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [client, expiry])

  useEffect(() => {
    document.documentElement.dataset.authBusy = String(
      dirty || mutation.isPending,
    )
    return () => {
      delete document.documentElement.dataset.authBusy
    }
  }, [dirty, mutation.isPending])

  async function submit(event, endpoint, body, destination) {
    event?.preventDefault()
    if (inFlight.current || !online) return
    if (endpoint === 'otp/verify' && !/^[0-9]{6}$/.test(body.code)) return
    const current = ++generation.current
    inFlight.current = current
    controller.current = new AbortController()
    let csrf = session.data?.csrf
    setNotice('')
    if (endpoint === 'logout') {
      logoutPending.current = true
      setLogoutUnconfirmed(true)
      setRevalidation((version) => version + 1)
      await client.cancelQueries()
      client.clear()
    }
    try {
      if (endpoint === 'logout' && (!csrf || logoutUnconfirmed)) {
        let fresh
        try {
          fresh = await client.fetchQuery(sessionQuery)
        } catch (error) {
          if (error.status !== 401) throw error
          fresh = await client.fetchQuery(sessionQuery)
        }
        if (current !== generation.current) return
        csrf = fresh.csrf
      }
      await mutation.mutateAsync({
        endpoint,
        body,
        csrf,
        signal: controller.current.signal,
      })
      if (current !== generation.current) return
      if (endpoint === 'password-reset/requests') {
        setRequestSent(true)
        setEmail('')
        return
      }
      if (endpoint === 'password-reset/complete') {
        await client.cancelQueries()
        client.clear()
        channel.current?.postMessage('changed')
        setRecoveryDone(true)
        await router.invalidate()
        return
      }
      await client.cancelQueries()
      client.clear()
      setPassword('')
      setConfirmation('')
      setCode('')
      setEmail('')
      channel.current?.postMessage('changed')
      logoutPending.current = false
      setLogoutUnconfirmed(false)
      await session.refetch()
      setRevalidation(0)
      if (destination) await navigate({ to: destination })
      else setNotice('Un nouveau code a été envoyé.')
      await client.invalidateQueries({ queryKey: sessionKey })
    } catch (error) {
      if (current !== generation.current) return
      if (error.status === 401 && endpoint !== 'login') {
        setRevalidation((version) => version + 1)
        await client.cancelQueries()
        client.clear()
      }
      setNotice(
        endpoint === 'logout'
          ? 'Déconnexion non confirmée. Reconnectez-vous au réseau puis réessayez.'
          : error.message,
      )
    } finally {
      if (inFlight.current === current) inFlight.current = null
      for (const pending of client.getMutationCache().getAll()) {
        if (pending.state.variables?.body === body)
          client.getMutationCache().remove(pending)
      }
      if (current === generation.current) {
        resetMutation()
        setPassword('')
        setConfirmation('')
        if (endpoint.startsWith('otp/')) setCode('')
      }
    }
  }

  const state =
    online && !session.isError && !session.isPending
      ? session.data?.state
      : null
  const verified = !revalidation && !session.isFetching && state === 'verified'
  const disabled = !online || mutation.isPending || !session.data?.csrf
  const criteria = [
    [password.length >= 8, '8 caractères minimum'],
    [/\p{Lu}/u.test(password), 'Une majuscule'],
    [/\p{Ll}/u.test(password), 'Une minuscule'],
    [/\p{Nd}/u.test(password), 'Un chiffre'],
    [/[^\p{L}\p{N}\s]/u.test(password), 'Un symbole'],
  ]
  let content
  if (!online)
    content = (
      <>
        <h1>Connexion indisponible</h1>
        <p>
          Une connexion est nécessaire pour accéder à votre espace. Aucune
          action ne sera envoyée automatiquement.
        </p>
        {notice && <p role="alert">{notice}</p>}
      </>
    )
  else if (logoutUnconfirmed)
    content = (
      <>
        <h1>{strings.logoutHeading}</h1>
        <form onSubmit={(e) => submit(e, 'logout', {}, '/login')}>
          <button className="auth-primary" disabled={mutation.isPending}>
            {strings.retryLogout}
          </button>
        </form>
      </>
    )
  else if (
    session.isPending ||
    (session.isFetching && session.isError) ||
    (revalidation && !session.isError) ||
    (state === 'verified' && session.isFetching)
  )
    content = (
      <AuthSkeleton
        label={path === '/identity' ? strings.accountLoading : strings.loading}
      />
    )
  else if (session.isError)
    content = (
      <>
        <h1>Session indisponible</h1>
        <p role="alert">Votre identité n’a pas pu être vérifiée.</p>
        <button
          className="auth-primary"
          onClick={async () => {
            const fresh = await session.refetch()
            if (!fresh.isError) setRevalidation(0)
          }}
        >
          Réessayer
        </button>
      </>
    )
  else if (verified && ['/', '/login', '/verification'].includes(path))
    return <Navigate to={workspacePath(session.data.user.role)} replace />
  else if (path === '/' || (path === '/verification' && state !== 'pending'))
    return (
      <Navigate to={state === 'pending' ? '/verification' : '/login'} replace />
    )
  else if (path === '/forgot-password')
    content = requestSent ? (
      <>
        <h1>{strings.forgotHeading}</h1>
        <p role="status">{strings.forgotConfirmation}</p>
        <Link to="/login" className="auth-secondary">
          {strings.backToLogin}
        </Link>
      </>
    ) : (
      <>
        <h1>{strings.forgotHeading}</h1>
        <p>{strings.forgotPrompt}</p>
        <form
          onSubmit={(event) =>
            submit(event, 'password-reset/requests', { email })
          }
        >
          <label>
            {strings.emailLabel}
            <input
              name="recoveryEmail"
              disabled={mutation.isPending}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button className="auth-primary" disabled={disabled}>
            {strings.forgotSubmit}
          </button>
        </form>
        <Link to="/login" className="auth-secondary">
          {strings.backToLogin}
        </Link>
      </>
    )
  else if (path === '/reset-password')
    content = recoveryDone ? (
      <>
        <h1>{strings.resetHeading}</h1>
        <p role="status">{strings.resetSuccess}</p>
        <Link to="/login" className="auth-primary">
          {strings.backToLogin}
        </Link>
      </>
    ) : !loader?.proof || !loader?.email ? (
      <>
        <h1>{strings.resetHeading}</h1>
        <p role="alert">{strings.invalidRecovery}</p>
        <Link to="/forgot-password" className="auth-secondary">
          {strings.newRecovery}
        </Link>
      </>
    ) : (
      <>
        <h1>{strings.resetHeading}</h1>
        <p>{strings.resetPrompt}</p>
        <form
          onSubmit={(event) =>
            submit(event, 'password-reset/complete', {
              ...loader.proof,
              password,
              confirmation,
            })
          }
        >
          <label>
            {strings.emailLabel}
            <input type="email" value={loader.email} readOnly />
          </label>
          <Password
            disabled={mutation.isPending}
            label={strings.newPasswordLabel}
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <ul className="auth-criteria" aria-live="polite">
            {criteria.map(([ok, label]) => (
              <li key={label} data-valid={ok}>
                {ok ? '✓' : '○'} {label}
              </li>
            ))}
          </ul>
          <Password
            disabled={mutation.isPending}
            label={strings.confirmationLabel}
            name="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          {confirmation && password !== confirmation && (
            <p role="status">{strings.passwordMismatch}</p>
          )}
          <button
            className="auth-primary"
            disabled={
              disabled ||
              !criteria.every(([ok]) => ok) ||
              password !== confirmation
            }
          >
            {strings.resetSubmit}
          </button>
        </form>
      </>
    )
  else if (verified)
    content = (
      <>
        <h1>{strings.accountHeading}</h1>
        <dl>
          <dt>Adresse e-mail</dt>
          <dd>{session.data.user.email}</dd>
          <dt>Rôle</dt>
          <dd>{roleLabels[session.data.user.role]}</dd>
        </dl>
        {session.data.user.role === 'ADMIN_PLATEFORME' && (
          <Link to="/access/users" className="auth-secondary">
            Gérer les utilisateurs
          </Link>
        )}
        {session.data.user.role === 'PARTENAIRE' && (
          <Link to="/partner" className="auth-secondary">
            Accéder à mon espace Partenaire
          </Link>
        )}
        <form onSubmit={(e) => submit(e, 'logout', {}, '/login')}>
          <button className="auth-primary" disabled={disabled}>
            Se déconnecter
          </button>
        </form>
      </>
    )
  else if (path === '/identity')
    return (
      <Navigate to={state === 'pending' ? '/verification' : '/login'} replace />
    )
  else if (path === '/invitation')
    content = (
      <>
        <h1>{strings.invitationTitle}</h1>
        <p>{strings.invitationPrompt}</p>
        {!loader?.proof || !loader?.email ? (
          <p role="alert">
            Ce lien est invalide ou a expiré. Contactez votre administrateur.
          </p>
        ) : (
          <form
            onSubmit={(e) =>
              submit(
                e,
                'invitations/accept',
                { ...loader.proof, password, confirmation },
                '/login',
              )
            }
          >
            <div className="auth-email-summary">
              <span>{strings.emailLabel}</span>
              <strong>{loader.email}</strong>
            </div>
            <Password
              disabled={mutation.isPending}
              label={strings.newPasswordLabel}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Password
              disabled={mutation.isPending}
              label="Confirmer le mot de passe"
              name="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
            <ul className="auth-criteria">
              {criteria.map(([ok, label]) => (
                <li key={label} data-valid={ok}>
                  {ok ? '✓' : '○'} {label}
                </li>
              ))}
            </ul>
            {confirmation && password !== confirmation && (
              <p role="status">{strings.passwordMismatch}</p>
            )}
            <button
              className="auth-primary"
              disabled={
                disabled ||
                !criteria.every(([ok]) => ok) ||
                password !== confirmation
              }
            >
              {strings.invitationSubmit}
            </button>
          </form>
        )}
        <Link to="/login" className="auth-secondary auth-return">
          {strings.backToLogin}
        </Link>
      </>
    )
  else if (state === 'pending')
    content = (
      <>
        <h1>{strings.otpHeading}</h1>
        <p className="auth-otp-intro">
          {strings.otpPrompt}
          <strong>{session.data.email || strings.otpEmailFallback}</strong>
        </p>
        <form onSubmit={(e) => submit(e, 'otp/verify', { code }, '/')}>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(completed) =>
              submit(null, 'otp/verify', { code: completed }, '/')
            }
            disabled={mutation.isPending}
          />
          <button
            className="auth-primary"
            disabled={disabled || !/^[0-9]{6}$/.test(code)}
          >
            {mutation.isPending && (
              <LoaderCircle
                className="auth-button-spinner"
                aria-hidden="true"
                size={16}
              />
            )}
            {strings.otpSubmit}
          </button>
        </form>
        <form
          className="auth-otp-resend"
          onSubmit={(e) => submit(e, 'otp/resend', {})}
        >
          <span>{strings.otpNotReceived}</span>
          <button className="auth-secondary" disabled={disabled}>
            {strings.otpResend}
          </button>
        </form>
        <form
          className="auth-otp-cancel"
          onSubmit={(e) => submit(e, 'logout', {}, '/login')}
        >
          <button className="auth-secondary" disabled={disabled}>
            {strings.backToLogin}
          </button>
        </form>
      </>
    )
  else
    content = (
      <>
        <h1>{strings.loginHeading}</h1>
        <form
          onSubmit={(e) =>
            submit(e, 'login', { email, password }, '/verification')
          }
        >
          <label>
            Adresse e-mail
            <input
              name="email"
              disabled={mutation.isPending}
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <Password
            disabled={mutation.isPending}
            label="Mot de passe"
            name="loginPassword"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link to="/forgot-password" className="auth-forgot">
            {strings.forgotLink}
          </Link>
          <button className="auth-primary" disabled={disabled}>
            {strings.loginSubmit}
          </button>
        </form>
      </>
    )

  const adminUser =
    path === '/identity' &&
    verified &&
    session.data.user.role === 'ADMIN_PLATEFORME'
      ? session.data.user
      : null
  return (
    <AuthFrame
      user={adminUser}
      title={authTitle(path)}
      busy={mutation.isPending}
    >
      {content}
      {online && notice && <p role="alert">{notice}</p>}
    </AuthFrame>
  )
}

function authTitle(path) {
  return path === '/forgot-password'
    ? strings.forgotTitle
    : path === '/reset-password'
      ? strings.resetTitle
      : path === '/invitation'
        ? strings.invitationTitle
        : path === '/verification'
          ? strings.otpHeading
          : path === '/identity'
            ? strings.accountHeading
            : strings.loginHeading
}

function AuthFrame({ user, title, busy, children }) {
  return (
    <div className={user ? 'access-layout' : 'auth-layout'}>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      {user ? (
        <AdminSidebar user={user} />
      ) : (
        <aside className="auth-brand" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </aside>
      )}
      <main className={user ? 'auth-main access-account-main' : 'auth-main'}>
        {!user && (
          <header>
            <img src="/icon-192.png" alt="" width="36" height="36" />
            <strong>MJL</strong>
          </header>
        )}
        <section className="auth-card" aria-busy={busy}>
          {children}
        </section>
      </main>
    </div>
  )
}

export function AuthLoading({ path }) {
  return (
    <AuthFrame title={authTitle(path)} busy>
      <AuthSkeleton
        label={path === '/identity' ? strings.accountLoading : strings.loading}
      />
    </AuthFrame>
  )
}

function AuthSkeleton({ label = strings.loading }) {
  return (
    <div
      className="auth-skeleton"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="auth-skeleton-heading" />
      <span />
      <span />
      <span />
    </div>
  )
}
