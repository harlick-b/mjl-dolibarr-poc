import { useSessionQuery } from '@/features/auth/SessionProvider'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Link,
  Navigate,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { sessionKey } from './auth'
import { roleLabels, workspacePath } from './authorization'
import { useAPI } from '@/shared/api/RestClientProvider'
import { Helmet } from 'react-helmet-async'
import { strings } from '@/locales/fr/AuthView'
import { strings as common } from '@/locales/fr/common'
import { OtpInput } from './OtpInput'
import { AdminSidebar } from '@/features/access/AdminSidebar'
import {
  broadcastAuthenticationChange,
  isLocalAuthenticationChange,
  useAccess,
} from './access-verification'

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
  const sessionResult = useSessionQuery()
  const access = useAccess()
  const verifyAccess = access.verify
  const refetchAccess = useCallback(async () => {
    try {
      const data = await verifyAccess({ manual: true })
      return { data, isError: false, error: null }
    } catch (error) {
      return { data: undefined, isError: true, error }
    }
  }, [verifyAccess])
  const session = {
    ...sessionResult,
    data: access.session,
    isPending: access.status === 'unknown' || access.status === 'checking',
    isFetching: access.status === 'checking',
    isError: access.status === 'blocked',
    error: access.status === 'blocked' ? access.reason : sessionResult.error,
    refetch: refetchAccess,
  }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [revalidation, setRevalidation] = useState(0)
  const logoutPending = useRef(false)
  const logoutCsrf = useRef(null)
  const [logoutUnconfirmed, setLogoutUnconfirmed] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [recoveryDone, setRecoveryDone] = useState(false)
  const generation = useRef(0)
  const controller = useRef(null)
  const inFlight = useRef(null)
  const previousPath = useRef(path)
  const dirty = Boolean(email || password || confirmation || code)
  const mutation = useMutation({
    mutationKey: ['auth', 'form'],
    retry: false,
    networkMode: 'always',
    mutationFn: ({ endpoint, body, csrf, signal }) =>
      api.auth(endpoint, { body, csrf, signal }),
    meta: { localError: true },
  })
  const resetMutation = mutation.reset

  useEffect(() => {
    if (previousPath.current === path) return
    previousPath.current = path
    generation.current += 1
    inFlight.current = null
    controller.current?.abort()
    resetMutation()
    setPassword('')
    setConfirmation('')
    setCode('')
  }, [path, resetMutation])

  useEffect(
    () => () => {
      generation.current += 1
      inFlight.current = null
      controller.current?.abort()
      for (const pending of client
        .getMutationCache()
        .findAll({ mutationKey: ['auth', 'form'] }))
        client.getMutationCache().remove(pending)
    },
    [client],
  )

  // These listeners clear only this public form. The access coordinator owns
  // session revalidation; Router retains the already-inspected proof context.
  useEffect(() => {
    const clearForm = () => {
      generation.current += 1
      inFlight.current = null
      controller.current?.abort()
      resetMutation()
      setEmail('')
      setPassword('')
      setConfirmation('')
      setCode('')
      for (const pending of client
        .getMutationCache()
        .findAll({ mutationKey: ['auth', 'form'] }))
        client.getMutationCache().remove(pending)
    }
    const channel = new BroadcastChannel('mjl-auth')
    channel.onmessage = (event) => {
      if (!isLocalAuthenticationChange(event)) clearForm()
    }
    window.addEventListener('offline', clearForm)
    return () => {
      channel.close()
      window.removeEventListener('offline', clearForm)
    }
  }, [client, resetMutation])

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
    const retryingHeldLogout =
      endpoint === 'logout' && (logoutUnconfirmed || access.reason === 'logout')
    let csrf =
      endpoint === 'logout'
        ? (logoutCsrf.current ?? access.logoutCsrf ?? session.data?.csrf)
        : session.data?.csrf
    setNotice('')
    if (endpoint === 'logout') {
      if (csrf) logoutCsrf.current = csrf
      logoutPending.current = true
      setLogoutUnconfirmed(true)
      setRevalidation((version) => version + 1)
      access.holdLogout(csrf)
      await client.cancelQueries()
      client.clear()
    }
    try {
      if (endpoint === 'logout' && (retryingHeldLogout || !csrf)) {
        const preparedCsrf = await access.prepareLogout()
        if (current !== generation.current) return
        csrf = preparedCsrf
        logoutCsrf.current = csrf
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
        broadcastAuthenticationChange()
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
      broadcastAuthenticationChange()
      logoutPending.current = false
      logoutCsrf.current = null
      setLogoutUnconfirmed(false)
      access.releaseLogout()
      await access.verify({ manual: true, reason: 'credentials' })
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
        <h1>{strings.offlineTitle}</h1>
        <p>{strings.offlineMessage}</p>
        <button
          className="auth-primary"
          onClick={() => void access.verify({ manual: true }).catch(() => null)}
          type="button"
        >
          {common.retry}
        </button>
        {notice && <p role="alert">{notice}</p>}
      </>
    )
  else if (logoutUnconfirmed || access.reason === 'logout')
    content = (
      <>
        <h1>{strings.logoutHeading}</h1>
        <form onSubmit={(e) => submit(e, 'logout', {}, '/login')}>
          <AuthButton
            className="auth-primary"
            disabled={mutation.isPending}
            busy={
              mutation.isPending && mutation.variables?.endpoint === 'logout'
            }
          >
            {strings.retryLogout}
          </AuthButton>
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
      <AuthMinimalLoading
        label={path === '/identity' ? strings.accountLoading : common.loading}
      />
    )
  else if (
    session.isError ||
    (access.status === 'anonymous' && !access.session)
  )
    content = (
      <>
        <h1>{strings.sessionUnavailable}</h1>
        <p role="alert">{strings.identityUnavailable}</p>
        <button
          className="auth-primary"
          onClick={async () => {
            const fresh = await session.refetch()
            if (!fresh.isError) setRevalidation(0)
          }}
        >
          {common.retry}
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
          <AuthButton
            className="auth-primary"
            disabled={disabled}
            busy={
              mutation.isPending &&
              mutation.variables?.endpoint === 'password-reset/requests'
            }
          >
            {strings.forgotSubmit}
          </AuthButton>
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
        <h1>{strings.invalidResetTitle}</h1>
        <p role="alert">{strings.invalidResetMessage}</p>
        <Link to="/forgot-password" className="auth-primary">
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
          <AuthButton
            busy={
              mutation.isPending &&
              mutation.variables?.endpoint === 'password-reset/complete'
            }
            className="auth-primary"
            disabled={
              disabled ||
              !criteria.every(([ok]) => ok) ||
              password !== confirmation
            }
          >
            {strings.resetSubmit}
          </AuthButton>
        </form>
      </>
    )
  else if (verified)
    content = (
      <>
        <h1>{common.accountHeading}</h1>
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
          <AuthButton
            className="auth-primary"
            disabled={disabled}
            busy={
              mutation.isPending && mutation.variables?.endpoint === 'logout'
            }
          >
            Se déconnecter
          </AuthButton>
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
        <h1>
          {!loader?.proof || !loader?.email
            ? strings.invalidInvitationTitle
            : strings.invitationTitle}
        </h1>
        <p role={!loader?.proof || !loader?.email ? 'alert' : undefined}>
          {!loader?.proof || !loader?.email
            ? strings.invalidInvitationMessage
            : strings.invitationPrompt}
        </p>
        {loader?.proof && loader?.email && (
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
            <AuthButton
              busy={
                mutation.isPending &&
                mutation.variables?.endpoint === 'invitations/accept'
              }
              className="auth-primary"
              disabled={
                disabled ||
                !criteria.every(([ok]) => ok) ||
                password !== confirmation
              }
            >
              {strings.invitationSubmit}
            </AuthButton>
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
          <AuthButton
            className="auth-primary"
            disabled={disabled || !/^[0-9]{6}$/.test(code)}
            busy={
              mutation.isPending &&
              mutation.variables?.endpoint === 'otp/verify'
            }
          >
            {strings.otpSubmit}
          </AuthButton>
        </form>
        <form
          className="auth-otp-resend"
          onSubmit={(e) => submit(e, 'otp/resend', {})}
        >
          <span>{strings.otpNotReceived}</span>
          <AuthButton
            className="auth-secondary"
            disabled={disabled}
            busy={
              mutation.isPending &&
              mutation.variables?.endpoint === 'otp/resend'
            }
          >
            {strings.otpResend}
          </AuthButton>
        </form>
        <form
          className="auth-otp-cancel"
          onSubmit={(e) => submit(e, 'logout', {}, '/login')}
        >
          <AuthButton
            className="auth-secondary"
            disabled={disabled}
            busy={
              mutation.isPending && mutation.variables?.endpoint === 'logout'
            }
          >
            {strings.backToLogin}
          </AuthButton>
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
          <AuthButton
            className="auth-primary"
            disabled={disabled}
            busy={
              mutation.isPending && mutation.variables?.endpoint === 'login'
            }
          >
            {strings.loginSubmit}
          </AuthButton>
        </form>
      </>
    )

  const adminUser =
    path === '/identity' &&
    !revalidation &&
    state === 'verified' &&
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
            ? common.accountHeading
            : strings.loginHeading
}

export function AuthFrame({ user, title, busy, children }) {
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
      <AuthMinimalLoading
        label={path === '/identity' ? strings.accountLoading : common.loading}
      />
    </AuthFrame>
  )
}

export function AccessVerificationState({
  failed = false,
  offline = false,
  onRetry,
}) {
  const title = offline
    ? strings.offlineTitle
    : failed
      ? strings.verificationFailed
      : strings.verificationTitle
  return (
    <AuthFrame title={title} busy={!failed}>
      <div
        className="auth-access-state"
        role={failed ? 'alert' : 'status'}
        aria-label={failed ? undefined : strings.verificationTitle}
        aria-busy={failed ? undefined : 'true'}
      >
        <div className="auth-access-heading">
          {!failed && (
            <LoaderCircle
              className="page-loading-spinner"
              size={22}
              aria-hidden="true"
            />
          )}
          <h1>{title}</h1>
        </div>
        <p>
          {offline
            ? strings.offlineMessage
            : failed
              ? strings.verificationFailedMessage
              : strings.verificationMessage}
        </p>
        {failed && (
          <button className="auth-primary" onClick={onRetry} type="button">
            {common.retry}
          </button>
        )}
      </div>
    </AuthFrame>
  )
}

function AuthMinimalLoading({ label = common.loading }) {
  return (
    <div
      className="auth-minimal-loading"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <LoaderCircle
        className="page-loading-spinner"
        size={22}
        aria-hidden="true"
      />
      <p>{common.loading}</p>
    </div>
  )
}

function AuthButton({ busy, children, ...props }) {
  return (
    <button {...props} aria-busy={busy || undefined}>
      {busy && (
        <LoaderCircle
          className="auth-button-spinner"
          aria-hidden="true"
          size={16}
        />
      )}
      {children}
    </button>
  )
}
