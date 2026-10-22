import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { authRequest, sessionKey, sessionQuery, roleLabels } from './auth'

function subscribeOnline(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function Password({ label, name, value, onChange }) {
  const [visible, setVisible] = useState(false)
  return (
    <label>
      {label}
      <span className="auth-password">
        <input
          name={name}
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
  const client = useQueryClient()
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine)
  const session = useQuery(sessionQuery)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [blocked, setBlocked] = useState(false)
  const logoutPending = useRef(false)
  const [logoutUnconfirmed, setLogoutUnconfirmed] = useState(false)
  const generation = useRef(0)
  const channel = useRef(null)
  const controller = useRef(null)
  const dirty = Boolean(email || password || confirmation || code)
  const mutation = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: ({ endpoint, body, csrf, signal }) =>
      authRequest(endpoint, { body, csrf, signal }),
  })
  const resetMutation = mutation.reset
  const expiry = session.data?.expires_at

  useEffect(() => {
    const invalidate = () => {
      setBlocked(true)
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
      controller.current?.abort()
      void client.cancelQueries()
      client.clear()
    }
    const broadcast = new BroadcastChannel('mjl-auth')
    channel.current = broadcast
    broadcast.onmessage = invalidate
    window.addEventListener('offline', invalidate)
    return () => {
      generation.current += 1
      controller.current?.abort()
      resetMutation()
      client.getMutationCache().clear()
      broadcast.close()
      window.removeEventListener('offline', invalidate)
    }
  }, [client, resetMutation])

  useEffect(() => {
    if (!expiry) return
    const timer = window.setTimeout(
      () => {
        setBlocked(true)
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
    event.preventDefault()
    if (mutation.isPending) return
    const current = ++generation.current
    controller.current = new AbortController()
    let csrf = session.data?.csrf
    setNotice('')
    if (endpoint === 'logout') {
      logoutPending.current = true
      setLogoutUnconfirmed(true)
      setBlocked(true)
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
      setBlocked(false)
      if (destination) await navigate({ to: destination })
      else setNotice('Un nouveau code a été envoyé.')
      await client.invalidateQueries({ queryKey: sessionKey })
    } catch (error) {
      if (current !== generation.current) return
      if (error.status === 401) {
        await client.cancelQueries()
        client.clear()
      }
      if (error.status === 401) setBlocked(true)
      setNotice(
        endpoint === 'logout'
          ? 'Déconnexion non confirmée. Reconnectez-vous au réseau puis réessayez.'
          : error.message,
      )
    } finally {
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
  const verified = !blocked && !session.isFetching && state === 'verified'
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
  else if (blocked)
    content = (
      <>
        <h1>Session à vérifier</h1>
        <p>Votre identité doit être vérifiée à nouveau.</p>
        <button
          className="auth-primary"
          onClick={async () => {
            const fresh = await session.refetch()
            if (!fresh.isError) setBlocked(false)
          }}
        >
          Vérifier ma session
        </button>
        {logoutUnconfirmed && (
          <form onSubmit={(e) => submit(e, 'logout', {}, '/login')}>
            <button className="auth-secondary">Réessayer la déconnexion</button>
          </form>
        )}
      </>
    )
  else if (session.isPending)
    content = <p role="status">Vérification de la session…</p>
  else if (session.isError)
    content = (
      <>
        <h1>Session indisponible</h1>
        <p role="alert">Votre identité n’a pas pu être vérifiée.</p>
        <button className="auth-primary" onClick={() => session.refetch()}>
          Réessayer
        </button>
      </>
    )
  else if (verified)
    content = (
      <>
        <ShieldCheck size={32} />
        <h1>Session vérifiée</h1>
        <p>Vous êtes connecté à l’espace MJL.</p>
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
        <form onSubmit={(e) => submit(e, 'logout', {}, '/login')}>
          <button className="auth-primary" disabled={disabled}>
            Se déconnecter
          </button>
        </form>
      </>
    )
  else if (path === '/identity')
    content = (
      <>
        <h1>Connexion requise</h1>
        <p>Vérifiez votre identité pour accéder à cet espace.</p>
        <Link to={state === 'pending' ? '/verification' : '/login'}>
          Continuer la connexion
        </Link>
      </>
    )
  else if (path === '/invitation')
    content = (
      <>
        <h1>Définir votre mot de passe</h1>
        <p>
          Votre accès a été créé par un administrateur. Choisissez votre mot de
          passe pour activer votre compte.
        </p>
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
            <label>
              Adresse e-mail
              <input type="email" value={loader.email} readOnly />
            </label>
            <Password
              label="Mot de passe"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <ul className="auth-criteria">
              {criteria.map(([ok, label]) => (
                <li key={label} data-valid={ok}>
                  {ok ? '✓' : '○'} {label}
                </li>
              ))}
            </ul>
            <Password
              label="Confirmer le mot de passe"
              name="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
            <button
              className="auth-primary"
              disabled={
                disabled ||
                !criteria.every(([ok]) => ok) ||
                password !== confirmation
              }
            >
              Définir mon mot de passe
            </button>
          </form>
        )}
      </>
    )
  else if (state === 'pending')
    content = (
      <>
        <h1>Vérifiez votre identité</h1>
        <p>
          Saisissez le code à six chiffres envoyé à{' '}
          {session.data.email || 'votre adresse e-mail'}.
        </p>
        <form onSubmit={(e) => submit(e, 'otp/verify', { code }, '/identity')}>
          <label>
            Code de vérification
            <span className="auth-otp-wrap">
              <span className="auth-otp-slots" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i}>{code[i] || ''}</span>
                ))}
              </span>
              <input
                className="auth-otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
              />
            </span>
          </label>
          <button
            className="auth-primary"
            disabled={disabled || code.length !== 6}
          >
            Vérifier le code
          </button>
        </form>
        <form onSubmit={(e) => submit(e, 'otp/resend', {})}>
          <button className="auth-secondary" disabled={disabled}>
            Renvoyer un code
          </button>
        </form>
        <form onSubmit={(e) => submit(e, 'logout', {}, '/login')}>
          <button className="auth-secondary" disabled={disabled}>
            Annuler la connexion
          </button>
        </form>
      </>
    )
  else
    content = (
      <>
        <h1>Connexion à votre espace</h1>
        <p>
          Accédez à la plateforme de suivi des projets du Ministère de la
          Justice et de la Législation.
        </p>
        <form
          onSubmit={(e) =>
            submit(e, 'login', { email, password }, '/verification')
          }
        >
          <label>
            Adresse e-mail
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <Password
            label="Mot de passe"
            name="loginPassword"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="auth-primary" disabled={disabled}>
            Se connecter
          </button>
        </form>
        <p className="auth-note">
          <LockKeyhole size={16} /> Un code de vérification vous sera envoyé par
          e-mail.
        </p>
      </>
    )

  return (
    <div className="auth-layout">
      <aside className="auth-brand">
        <img src="/icon-192.png" alt="" width="56" height="56" />
        <p>
          MINISTÈRE DE LA JUSTICE
          <br />
          ET DE LA LÉGISLATION
        </p>
        <div className="auth-brand-message">
          <h2>
            Une gestion rigoureuse.
            <br />
            Un impact durable.
          </h2>
          <p>
            Plateforme de suivi des projets financés sur ressources extérieures.
          </p>
        </div>
        <span>République du Bénin</span>
      </aside>
      <main className="auth-main">
        <header>
          <img src="/icon-192.png" alt="" width="40" height="40" />
          <strong>Espace MJL</strong>
        </header>
        <section className="auth-card" aria-busy={mutation.isPending}>
          {content}
          {online && notice && <p role="alert">{notice}</p>}
          {mutation.isPending && <p role="status">Traitement en cours…</p>}
        </section>
        <footer>Accès sécurisé · Sur invitation uniquement</footer>
      </main>
    </div>
  )
}
