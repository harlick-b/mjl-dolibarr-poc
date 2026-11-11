import { AuthFrame, AuthLoading } from '../components/AuthFrame'
import { authTitle } from '../lib/auth-title'
import { Urls } from '@/app/urls'
import { useLogout } from '../session/LogoutProvider'
import { loginDestination } from '../session/navigation'
import { buttonVariants } from '@/shared/ui/button-variants'
import { useSessionQuery } from '@/features/auth/session/SessionProvider'
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
import { sessionKey } from '../session/auth'
import { useAPI } from '@/shared/api/RestClientProvider'
import { strings } from '@/locales/fr/AuthView'
import { strings as common } from '@/locales/fr/common'
import { OtpInput } from '../components/OtpInput'
import {
  broadcastAuthenticationChange,
  isLocalAuthenticationChange,
  useAccess,
} from '../session/access-verification'

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
      {label} *
      <span className="flex relative [&_input]:pr-12 [&_button]:absolute [&_button]:right-0 [&_button]:top-0 [&_button]:min-h-11 [&_button]:w-11 [&_button]:grid [&_button]:place-items-center [&_button]:text-muted-foreground">
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
  return <AuthPage key={path} path={path} />
}

function AuthPage({ path }) {
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
  const loginEmail = useRouterState({
    select: (state) => state.location.state.loginEmail,
  })
  const returnTo = useRouterState({
    select: (state) => state.location.state.returnTo,
  })
  const [email, setEmail] = useState(() =>
    path === Urls.login && typeof loginEmail === 'string' ? loginEmail : '',
  )
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [revalidation, setRevalidation] = useState(0)
  const { logout } = useLogout()
  const [transition, setTransition] = useState(null)
  const [requestSent, setRequestSent] = useState(false)
  const [recoveryDone, setRecoveryDone] = useState(false)
  const generation = useRef(0)
  const controller = useRef(null)
  const inFlight = useRef(null)
  const dirty = Boolean(email || password || confirmation || code)
  const mutation = useMutation({
    mutationKey: ['auth', 'form'],
    retry: false,
    networkMode: 'always',
    mutationFn: ({ endpoint, body, csrf, signal }) =>
      api.auth(endpoint, { body, csrf, signal }),
    meta: { localError: true },
  })
  const busy = Boolean(transition) || mutation.isPending
  const resetMutation = mutation.reset

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
      setTransition(null)
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
    if (!revalidation || !online) return
    const current = generation.current
    let cancelled = false
    void refetchSession().then((fresh) => {
      if (!cancelled && current === generation.current && !fresh.isError)
        setRevalidation(0)
    })
    return () => {
      cancelled = true
    }
  }, [revalidation, online, refetchSession])

  useEffect(() => {
    document.documentElement.dataset.authBusy = String(dirty || busy)
    return () => {
      delete document.documentElement.dataset.authBusy
    }
  }, [dirty, busy])

  async function submit(event, endpoint, body, destination) {
    event?.preventDefault()
    if (endpoint === 'logout') {
      void logout()
      return
    }
    if (inFlight.current || !online) return
    if (endpoint === 'otp/verify' && !/^[0-9]{6}$/.test(body.code)) return
    const current = ++generation.current
    inFlight.current = current
    controller.current = new AbortController()
    const csrf = session.data?.csrf
    setNotice('')
    setTransition({ endpoint, session: session.data })
    try {
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
        client.removeQueries({
          predicate: (query) => query.queryKey[0] !== 'auth',
        })
        client.getMutationCache().clear()
        client.setQueryData(sessionKey, null)
        broadcastAuthenticationChange()
        setRecoveryDone(true)
        await router.invalidate()
        return
      }
      await client.cancelQueries()
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth',
      })
      client.getMutationCache().clear()
      client.setQueryData(sessionKey, null)
      broadcastAuthenticationChange()
      const fresh = await access.verify({ manual: true, reason: 'credentials' })
      if (current !== generation.current) return
      setRevalidation(0)
      if (destination)
        await navigate({
          to:
            destination === Urls.home
              ? loginDestination(fresh, returnTo)
              : destination,
          replace: true,
          ...(endpoint === 'invitations/accept'
            ? { state: { loginEmail: loader.email } }
            : destination === Urls.verification && typeof returnTo === 'string'
              ? { state: { returnTo } }
              : {}),
        })
      else setNotice('Un nouveau code a été envoyé.')
    } catch (error) {
      if (current !== generation.current) return
      if (error.status === 401 && endpoint !== 'login') {
        setRevalidation((version) => version + 1)
        await client.cancelQueries()
        client.removeQueries({
          predicate: (query) => query.queryKey[0] !== 'auth',
        })
        client.getMutationCache().clear()
        client.setQueryData(sessionKey, null)
      }
      setNotice(error.message)
    } finally {
      if (inFlight.current === current) inFlight.current = null
      for (const pending of client.getMutationCache().getAll()) {
        if (pending.state.variables?.body === body)
          client.getMutationCache().remove(pending)
      }
      if (current === generation.current) {
        resetMutation()
        setTransition(null)
        setPassword('')
        setConfirmation('')
        if (endpoint.startsWith('otp/')) setCode('')
      }
    }
  }

  const displaySession =
    transition && !session.isError ? transition.session : session.data
  const state =
    online && !session.isError && (!session.isPending || transition)
      ? displaySession?.state
      : null
  const verified =
    !transition && !revalidation && !session.isFetching && state === 'verified'
  const disabled = !online || busy || !session.data?.csrf
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
          className={buttonVariants({ variant: 'auth' })}
          data-ui="auth-primary"
          onClick={() => void access.verify({ manual: true }).catch(() => null)}
          type="button"
        >
          {common.retry}
        </button>
        {notice && <p role="alert">{notice}</p>}
      </>
    )
  else if (
    (!transition && session.isPending) ||
    (session.isFetching && session.isError) ||
    (revalidation && !session.isError && !transition) ||
    (state === 'verified' && session.isFetching)
  )
    content = (
      <AuthMinimalLoading
        label={path === Urls.identity ? strings.accountLoading : common.loading}
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
          className={buttonVariants({ variant: 'auth' })}
          data-ui="auth-primary"
          onClick={async () => {
            const fresh = await session.refetch()
            if (!fresh.isError) setRevalidation(0)
          }}
        >
          {common.retry}
        </button>
      </>
    )
  else if (
    verified &&
    [Urls.home, Urls.login, Urls.verification].includes(path)
  )
    return <Navigate to={loginDestination(session.data, returnTo)} replace />
  else if (
    path === Urls.home ||
    (path === Urls.verification && state !== 'pending')
  )
    return (
      <Navigate
        to={state === 'pending' ? Urls.verification : Urls.login}
        replace
      />
    )
  else if (path === Urls.forgotPassword)
    content = requestSent ? (
      <>
        <h1>{strings.forgotHeading}</h1>
        <p role="status">{strings.forgotConfirmation}</p>
        <Link
          to={Urls.login}
          className="inline-flex justify-center items-center text-primary min-h-11 text-[0.8125rem] leading-5"
        >
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
            {strings.emailLabel} *
            <input
              name="recoveryEmail"
              disabled={busy}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <AuthButton
            className={buttonVariants({ variant: 'auth' })}
            data-ui="auth-primary"
            disabled={disabled}
            busy={
              busy &&
              (transition?.endpoint || mutation.variables?.endpoint) ===
                'password-reset/requests'
            }
          >
            {strings.forgotSubmit}
          </AuthButton>
        </form>
        <Link
          to={Urls.login}
          className="inline-flex justify-center items-center text-primary min-h-11 text-[0.8125rem] leading-5"
        >
          {strings.backToLogin}
        </Link>
      </>
    )
  else if (path === Urls.resetPassword)
    content = recoveryDone ? (
      <>
        <h1>{strings.resetHeading}</h1>
        <p role="status">{strings.resetSuccess}</p>
        <Link
          to={Urls.login}
          className={buttonVariants({ variant: 'auth' })}
          data-ui="auth-primary"
        >
          {strings.backToLogin}
        </Link>
      </>
    ) : !loader?.proof || !loader?.email ? (
      <>
        <h1>{strings.invalidResetTitle}</h1>
        <p role="alert">{strings.invalidResetMessage}</p>
        <Link
          to={Urls.forgotPassword}
          className={buttonVariants({ variant: 'auth' })}
          data-ui="auth-primary"
        >
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
            disabled={busy}
            label={strings.newPasswordLabel}
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <ul
            className="flex flex-wrap gap-2 list-none text-xs leading-5 text-muted-foreground [&_li]:bg-background [&_li]:rounded [&_li]:py-1 [&_li]:px-2 [&_li[data-valid='true']]:text-primary [&_li[data-valid='true']]:bg-selected"
            aria-live="polite"
          >
            {criteria.map(([ok, label]) => (
              <li key={label} data-valid={ok}>
                {ok ? '✓' : '○'} {label}
              </li>
            ))}
          </ul>
          <Password
            disabled={busy}
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
              busy &&
              (transition?.endpoint || mutation.variables?.endpoint) ===
                'password-reset/complete'
            }
            className={buttonVariants({ variant: 'auth' })}
            data-ui="auth-primary"
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
  else if (verified && path === Urls.invitation)
    return <Navigate to={loginDestination(session.data)} replace />
  else if (path === Urls.invitation)
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
                Urls.login,
              )
            }
          >
            <div className="grid gap-1 py-3 px-4 rounded-panel bg-selected wrap-anywhere text-[0.8125rem] leading-5 [&_span]:text-muted-foreground [&_span]:text-xs [&_strong]:font-medium">
              <span>{strings.emailLabel}</span>
              <strong>{loader.email}</strong>
            </div>
            <Password
              disabled={busy}
              label={strings.newPasswordLabel}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Password
              disabled={busy}
              label="Confirmer le mot de passe"
              name="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
            <ul className="flex flex-wrap gap-2 list-none text-xs leading-5 text-muted-foreground [&_li]:bg-background [&_li]:rounded [&_li]:py-1 [&_li]:px-2 [&_li[data-valid='true']]:text-primary [&_li[data-valid='true']]:bg-selected">
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
                busy &&
                (transition?.endpoint || mutation.variables?.endpoint) ===
                  'invitations/accept'
              }
              className={buttonVariants({ variant: 'auth' })}
              data-ui="auth-primary"
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
        <Link
          to={Urls.login}
          className="flex justify-center items-center text-primary min-h-11 text-[0.8125rem] leading-5 mt-4"
        >
          {strings.backToLogin}
        </Link>
      </>
    )
  else if (state === 'pending')
    content = (
      <>
        <h1>{strings.otpHeading}</h1>
        <p className="[&_strong]:block [&_strong]:mt-2 [&_strong]:text-foreground [&_strong]:font-medium">
          {strings.otpPrompt}
          <strong>{displaySession.email || strings.otpEmailFallback}</strong>
        </p>
        <form onSubmit={(e) => submit(e, 'otp/verify', { code }, Urls.home)}>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(completed) =>
              submit(null, 'otp/verify', { code: completed }, Urls.home)
            }
            disabled={busy}
          />
          <AuthButton
            className={buttonVariants({ variant: 'auth' })}
            data-ui="auth-primary"
            disabled={disabled || !/^[0-9]{6}$/.test(code)}
            busy={
              busy &&
              (transition?.endpoint || mutation.variables?.endpoint) ===
                'otp/verify'
            }
          >
            {strings.otpSubmit}
          </AuthButton>
        </form>
        <form
          className="mt-4 flex items-center justify-center gap-2 text-[0.8125rem] text-muted-foreground"

          onSubmit={(e) => submit(e, 'otp/resend', {})}
        >
          <span>{strings.otpNotReceived}</span>
          <AuthButton
            className="inline-flex justify-center items-center text-primary min-h-11 text-[0.8125rem] leading-5"
            disabled={disabled}
            busy={
              busy &&
              (transition?.endpoint || mutation.variables?.endpoint) ===
                'otp/resend'
            }
          >
            {strings.otpResend}
          </AuthButton>
        </form>
        <form
          className="mt-0"

          onSubmit={(e) => submit(e, 'logout', {}, Urls.login)}
        >
          <AuthButton
            className="inline-flex justify-center items-center text-primary min-h-11 text-[0.8125rem] leading-5"
            disabled={disabled}
            busy={
              busy &&
              (transition?.endpoint || mutation.variables?.endpoint) ===
                'logout'
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
            submit(e, 'login', { email, password }, Urls.verification)
          }
        >
          <label>
            Adresse e-mail *
            <input
              name="email"
              disabled={busy}
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <Password
            disabled={busy}
            label="Mot de passe"
            name="loginPassword"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link
            to={Urls.forgotPassword}
            className="inline-flex justify-center items-center text-primary min-h-11 text-[0.8125rem] leading-5 -mt-5 justify-self-end"
          >
            {strings.forgotLink}
          </Link>
          <AuthButton
            className={buttonVariants({ variant: 'auth' })}
            data-ui="auth-primary"
            disabled={disabled}
            busy={
              busy &&
              (transition?.endpoint || mutation.variables?.endpoint) === 'login'
            }
          >
            {strings.loginSubmit}
          </AuthButton>
        </form>
      </>
    )

  if (session.isPending && !transition) return <AuthLoading path={path} />
  return (
    <AuthFrame title={authTitle(path)} busy={busy}>
      {content}
      {online && notice && <p role="alert">{notice}</p>}
    </AuthFrame>
  )
}

export function ServiceUnavailableLogin() {
  const navigate = useNavigate()
  const { logout, busy } = useLogout()
  useEffect(() => {
    void navigate({ to: Urls.login, replace: true })
  }, [navigate])
  return (
    <AuthFrame title={strings.loginHeading} busy={busy}>
      <h1>{strings.loginHeading}</h1>
      <p role="alert">{strings.serviceLoginMessage}</p>
      <button
        type="button"
        className={buttonVariants({ variant: 'auth' })}
        disabled={busy}
        onClick={() => void logout()}
      >
        {strings.retryConnection}
      </button>
    </AuthFrame>
  )
}

function AuthMinimalLoading({ label = common.loading }) {
  return (
    <div
      className="min-h-28 grid place-content-center justify-items-center gap-2 text-muted-foreground [&_p]:m-0"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <LoaderCircle
        className="text-primary animate-spin [animation-duration:0.8s]"
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
        <LoaderCircle className="animate-spin" aria-hidden="true" size={16} />
      )}
      {children}
    </button>
  )
}
