import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, Users, X } from 'lucide-react'
import { apiRequest, roleLabels, sessionKey, sessionQuery } from './auth'
import { Button } from './components/ui/button'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const states = {
  pending: 'En attente',
  active: 'Actif',
  inactive: 'Inactif',
  prepared: 'En préparation',
  delivered: 'Envoyée',
  consumed: 'Acceptée',
  revoked: 'Révoquée',
}
const deliveryLabels = {
  delivered: 'Envoyée',
  failed: 'Envoi échoué',
  unconfirmed: 'Envoi non confirmé',
}

export function AccessView() {
  const client = useQueryClient()
  const session = useQuery(sessionQuery)
  const online = useSyncExternalStore(subscribe, () => navigator.onLine)
  const [blocked, setBlocked] = useState(false)
  const expiry = session.data?.expires_at
  const user = session.data?.user
  useEffect(() => {
    const clear = () => {
      setBlocked(true)
      void client.cancelQueries()
      client.clear()
    }
    const channel = new BroadcastChannel('mjl-auth')
    channel.onmessage = clear
    window.addEventListener('offline', clear)
    const timer = expiry
      ? setTimeout(clear, Math.max(0, Date.parse(expiry) - Date.now()))
      : undefined
    return () => {
      channel.close()
      window.removeEventListener('offline', clear)
      clearTimeout(timer)
    }
  }, [client, expiry])
  useEffect(() => {
    if (
      session.isError ||
      (session.data && user?.role !== 'ADMIN_PLATEFORME')
    ) {
      void client.cancelQueries({ queryKey: ['access'] })
      client.removeQueries({ queryKey: ['access'] })
    }
  }, [client, session.isError, session.data, user?.role])
  if (!online || blocked)
    return (
      <section className="access-message">
        <h1>Accès à vérifier</h1>
        <p>
          Une connexion et une identité vérifiée sont nécessaires. Si une action
          était en cours, son résultat n’est pas confirmé : vérifiez les listes
          avant de la relancer.
        </p>
        <Button
          disabled={!online}
          onClick={async () => {
            await session.refetch()
            setBlocked(false)
          }}
        >
          Vérifier mon accès
        </Button>
        <Link to="/login">Connexion</Link>
      </section>
    )
  if (session.error?.status === 401 || session.data?.state === 'anonymous')
    return <Navigate to="/login" replace />
  if (session.data?.state === 'pending')
    return <Navigate to="/verification" replace />
  if (session.isError)
    return (
      <section className="access-message">
        <h1>Service indisponible</h1>
        <p role="alert">Votre identité n’a pas pu être vérifiée.</p>
        <Button onClick={() => session.refetch()}>Réessayer</Button>
      </section>
    )
  if (session.isPending)
    return (
      <p className="access-message" role="status">
        Vérification de votre accès…
      </p>
    )
  if (user?.role !== 'ADMIN_PLATEFORME')
    return (
      <section className="access-message">
        <h1>Accès refusé</h1>
        <p>Cette page est réservée à l’administration.</p>
        <Link to="/identity">Mon identité</Link>
      </section>
    )
  return (
    <Accounts
      key={user.id}
      session={session.data}
      checking={session.isFetching}
      onDenied={() => setBlocked(true)}
    />
  )
}

function listQuery(principal, kind, filters, onDenied) {
  return {
    queryKey: ['access', principal, kind, filters],
    retry: false,
    staleTime: 0,
    gcTime: 0,
    networkMode: 'always',
    queryFn: async ({ signal }) => {
      try {
        const result = await apiRequest(
          `/api/v1/access/${kind}?${new URLSearchParams(filters)}`,
          { signal },
        )
        if (
          !Array.isArray(result.items) ||
          !Number.isInteger(result.total) ||
          result.items.some(
            (item) =>
              !item.id ||
              !item.email ||
              !roleLabels[item.role] ||
              !states[item.state],
          )
        )
          throw new Error('Réponse indisponible. Réessayez.')
        return result
      } catch (error) {
        if ([401, 403].includes(error.status)) onDenied(error.status)
        throw error
      }
    },
  }
}

function Accounts({ session, onDenied, checking }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ from: '/access/users' })
  const [dialog, setDialog] = useState(null)
  const [notice, setNotice] = useState('')
  const alive = useRef(true)
  const controller = useRef(null)
  const mutation = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: ({ path, body, signal, method }) =>
      apiRequest(`/api/v1/access/${path}`, {
        body,
        method,
        signal,
        csrf: session.csrf,
      }),
  })
  const reset = mutation.reset
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      controller.current?.abort()
      reset()
      client.getMutationCache().clear()
      void client.cancelQueries({ queryKey: ['access'] })
      client.removeQueries({ queryKey: ['access'] })
    }
  }, [client, reset])
  useEffect(() => {
    document.documentElement.dataset.authBusy = String(
      Boolean(dialog) || mutation.isPending,
    )
    return () => {
      delete document.documentElement.dataset.authBusy
    }
  }, [dialog, mutation.isPending])
  const denied = (status) => {
    void client.cancelQueries({ queryKey: ['access'] })
    client.removeQueries({ queryKey: ['access'] })
    if (status === 401) client.removeQueries({ queryKey: sessionKey })
    void client.invalidateQueries({ queryKey: sessionKey })
    onDenied()
  }
  const userFilters = {
    page: search.page,
    size: 20,
    ...(search.email ? { email: search.email } : {}),
    ...(search.role ? { role: search.role } : {}),
    ...(search.state ? { state: search.state } : {}),
  }
  const invitationFilters = {
    page: search.invitationPage,
    size: 20,
    ...(search.email ? { email: search.email } : {}),
    ...(search.invitationState ? { state: search.invitationState } : {}),
  }
  const users = useQuery(
    listQuery(session.user.id, 'users', userFilters, denied),
  )
  const invitations = useQuery(
    listQuery(session.user.id, 'invitations', invitationFilters, denied),
  )
  const changeSearch = (values) =>
    navigate({ to: '/access/users', search: { ...search, ...values } })
  async function submit(event) {
    event.preventDefault()
    if (mutation.isPending) return
    const data = new FormData(event.currentTarget)
    const lifecycle = ['role', 'deactivate'].includes(dialog.kind)
    const path = lifecycle
      ? `users/${dialog.item.id}`
      : dialog.kind === 'invite'
        ? 'invitations'
        : `invitations/${dialog.item.id}/${dialog.kind}`
    const body =
      dialog.kind === 'invite'
        ? { email: data.get('email'), role: data.get('role') }
        : {
            expected_version: dialog.item.version,
            ...(dialog.kind === 'role' ? { role: data.get('role') } : {}),
            ...(dialog.kind === 'deactivate' ? { deactivate: true } : {}),
          }
    setNotice('')
    controller.current = new AbortController()
    try {
      const result = await mutation.mutateAsync({
        path,
        method: lifecycle ? 'PATCH' : 'POST',
        body,
        signal: controller.current.signal,
      })
      if (!alive.current) return
      setNotice(
        dialog.kind === 'role'
          ? result.version === dialog.item.version
            ? 'Rôle inchangé.'
            : 'Rôle modifié. Une nouvelle connexion est nécessaire.'
          : dialog.kind === 'deactivate'
            ? 'Compte désactivé.'
            : dialog.kind === 'revoke'
              ? 'Invitation révoquée.'
              : 'Invitation envoyée.',
      )
      setDialog(null)
    } catch (error) {
      if (!alive.current) return
      if ([401, 403].includes(error.status)) {
        denied(error.status)
        return
      }
      setDialog(null)
      setNotice(
        error.code === 'eligibility_unverified'
          ? 'Modification indisponible : l’éligibilité de ce compte ne peut pas être vérifiée.'
          : error.code === 'invitation_delivery_failed'
            ? 'Invitation créée, mais envoi échoué. Actualisez puis renvoyez l’invitation.'
            : error.status === 409
              ? 'L’état a changé ou ce compte existe déjà. Consultez la liste actualisée avant une nouvelle action.'
              : error.status === 422
                ? 'Demande refusée. Vérifiez l’adresse e-mail et le rôle.'
                : 'Résultat non confirmé. Actualisez les listes avant de réessayer.',
      )
    } finally {
      if (alive.current) {
        await client.invalidateQueries({
          queryKey: ['access', session.user.id],
        })
        reset()
        client.getMutationCache().clear()
      }
    }
  }
  return (
    <div
      className="access-layout"
      inert={checking || undefined}
      style={{ visibility: checking ? 'hidden' : undefined }}
    >
      <aside className="access-sidebar">
        <Link to="/identity" className="access-brand">
          <span className="access-mark">M</span>MJL
        </Link>
        <nav aria-label="Administration">
          <Link to="/access/users" aria-current="page">
            <Users size={18} />
            Utilisateurs
          </Link>
        </nav>
        <Link to="/identity" className="access-account">
          {session.user.email}
          <small>Admin · Mon compte</small>
        </Link>
      </aside>
      <div className="access-workspace">
        <header>Utilisateurs</header>
        <main className="access-main">
          <div className="access-heading">
            <h1>Utilisateurs</h1>
            <Button onClick={() => setDialog({ kind: 'invite' })}>
              <Plus size={18} />
              Inviter un utilisateur
            </Button>
          </div>
          {notice && (
            <p role="status" className="access-notice">
              {notice}
            </p>
          )}
          <form
            className="access-filters"
            onSubmit={(e) => {
              e.preventDefault()
              const d = new FormData(e.currentTarget)
              void changeSearch({
                email: d.get('email').trim(),
                role: d.get('role'),
                state: d.get('state'),
                page: 1,
                invitationPage: 1,
              })
            }}
          >
            <label>
              Rechercher par e-mail
              <input
                key={search.email}
                name="email"
                type="search"
                maxLength={254}
                defaultValue={search.email}
              />
            </label>
            <label>
              Rôle
              <select key={search.role} name="role" defaultValue={search.role}>
                <option value="">Tous les rôles</option>
                {Object.entries(roleLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              État du compte
              <select
                key={search.state}
                name="state"
                defaultValue={search.state}
              >
                <option value="">Tous les états</option>
                {['pending', 'active', 'inactive'].map((s) => (
                  <option key={s} value={s}>
                    {states[s]}
                  </option>
                ))}
              </select>
            </label>
            <Button>Filtrer</Button>
          </form>
          <ListState query={users} empty="Aucun utilisateur.">
            <div className="access-table-wrap">
              <table>
                <caption className="sr-only">Comptes utilisateurs</caption>
                <thead>
                  <tr>
                    <th>Adresse e-mail</th>
                    <th>Rôle</th>
                    <th>État</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data?.items.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{roleLabels[u.role]}</td>
                      <td>
                        <span className="access-status">{states[u.state]}</span>
                      </td>
                      <td>
                        {u.state === 'active' &&
                        u.role !== 'ADMIN_PLATEFORME' &&
                        u.id !== session.user.id ? (
                          <div className="access-actions">
                            <button
                              type="button"
                              disabled={mutation.isPending || users.isFetching}
                              onClick={() =>
                                setDialog({ kind: 'role', item: u })
                              }
                            >
                              Modifier le rôle
                            </button>
                            <button
                              type="button"
                              disabled={mutation.isPending || users.isFetching}
                              onClick={() =>
                                setDialog({ kind: 'deactivate', item: u })
                              }
                            >
                              Désactiver
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
          <Pagination
            query={users}
            page={search.page}
            change={(page) => changeSearch({ page })}
            label="Comptes"
          />
          <div className="access-heading">
            <h2>Invitations</h2>
            <label>
              État de l’invitation
              <select
                value={search.invitationState}
                onChange={(e) =>
                  changeSearch({
                    invitationState: e.target.value,
                    invitationPage: 1,
                  })
                }
              >
                <option value="">Tous les états</option>
                {['prepared', 'delivered', 'consumed', 'revoked'].map((s) => (
                  <option key={s} value={s}>
                    {states[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ListState query={invitations} empty="Aucune invitation.">
            <div className="access-table-wrap">
              <table>
                <caption className="sr-only">
                  Invitations des utilisateurs
                </caption>
                <thead>
                  <tr>
                    <th>Adresse e-mail</th>
                    <th>Rôle</th>
                    <th>État</th>
                    <th>Expiration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.data?.items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td>{roleLabels[i.role]}</td>
                      <td>
                        {states[i.state]}
                        <small>
                          {deliveryLabels[i.delivery_status]}
                          {['prepared', 'delivered'].includes(i.state) &&
                          Date.parse(i.expires_at) <= invitations.dataUpdatedAt
                            ? ' · Expirée'
                            : ''}
                        </small>
                      </td>
                      <td>{new Date(i.expires_at).toLocaleString('fr-FR')}</td>
                      <td>
                        {i.role !== 'ADMIN_PLATEFORME' &&
                        ['prepared', 'delivered'].includes(i.state) ? (
                          <div className="access-actions">
                            <button
                              type="button"
                              disabled={
                                mutation.isPending || invitations.isFetching
                              }
                              onClick={() =>
                                setDialog({ kind: 'resend', item: i })
                              }
                            >
                              Renvoyer
                            </button>
                            <button
                              type="button"
                              disabled={
                                mutation.isPending || invitations.isFetching
                              }
                              onClick={() =>
                                setDialog({ kind: 'revoke', item: i })
                              }
                            >
                              Révoquer
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
          <Pagination
            query={invitations}
            page={search.invitationPage}
            change={(invitationPage) => changeSearch({ invitationPage })}
            label="Invitations"
          />
          {dialog && (
            <AccessDialog
              dialog={dialog}
              pending={mutation.isPending}
              checking={checking}
              close={() => setDialog(null)}
              submit={submit}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function ListState({ query, empty, children }) {
  if (query.isPending || query.isFetching)
    return <p role="status">Chargement…</p>
  if (query.isError)
    return (
      <div role="alert">
        Liste indisponible.{' '}
        <button onClick={() => query.refetch()}>Actualiser</button>
      </div>
    )
  return query.data?.items.length ? (
    children
  ) : (
    <p className="access-empty">{empty}</p>
  )
}
function Pagination({ query, page, change, label }) {
  if (!query.data || query.isError) return null
  return (
    <nav className="access-pagination" aria-label={`Pagination ${label}`}>
      <button
        disabled={page <= 1 || query.isFetching}
        onClick={() => change(page - 1)}
      >
        Précédent
      </button>
      <span>
        Page {page} · {query.data.total} résultat(s)
      </span>
      <button
        disabled={page * 20 >= query.data.total || query.isFetching}
        onClick={() => change(page + 1)}
      >
        Suivant
      </button>
    </nav>
  )
}
function AccessDialog({ dialog, pending, checking, close, submit }) {
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    const trigger = document.activeElement
    node.showModal()
    return () => {
      node.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])
  const invite = dialog.kind === 'invite'
  const title = invite
    ? 'Inviter un utilisateur'
    : dialog.kind === 'role'
      ? 'Modifier le rôle'
      : dialog.kind === 'deactivate'
        ? 'Désactiver ce compte ?'
        : dialog.kind === 'revoke'
          ? 'Révoquer cette invitation ?'
          : 'Renvoyer cette invitation ?'
  return (
    <dialog
      ref={ref}
      className="access-dialog"
      inert={checking || undefined}
      style={{ visibility: checking ? 'hidden' : undefined }}
      aria-labelledby="invitation-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
          ),
        ]
        const first = controls[0]
        const last = controls.at(-1)
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault()
          last?.focus()
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault()
          first?.focus()
        }
      }}
      onCancel={(e) => {
        e.preventDefault()
        if (!pending) close()
      }}
    >
      <div className="access-heading">
        <h2 id="invitation-title">{title}</h2>
        <button aria-label="Fermer" disabled={pending} onClick={close}>
          <X size={20} />
        </button>
      </div>
      <form onSubmit={submit}>
        {invite ? (
          <div className="access-dialog-fields">
            <label>
              Adresse e-mail
              <input
                name="email"
                type="email"
                maxLength={254}
                required
                autoComplete="off"
              />
            </label>
            <label>
              Rôle
              <select name="role" defaultValue="AGENT_SAISIE">
                {Object.entries(roleLabels)
                  .filter(([r]) => r !== 'ADMIN_PLATEFORME')
                  .map(([r, l]) => (
                    <option key={r} value={r}>
                      {l}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        ) : dialog.kind === 'role' ? (
          <div className="access-dialog-fields">
            <p>{dialog.item.email}</p>
            <label>
              Nouveau rôle
              <select name="role" defaultValue={dialog.item.role}>
                {Object.entries(roleLabels)
                  .filter(([role]) => role !== 'ADMIN_PLATEFORME')
                  .map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <p>
              Les sessions actuelles seront invalidées. Une nouvelle connexion
              sera nécessaire.
            </p>
          </div>
        ) : (
          <p>
            {dialog.item.email}
            <br />
            {dialog.kind === 'deactivate'
              ? 'Ce compte ne pourra plus se connecter. Ses sessions actuelles seront invalidées.'
              : dialog.kind === 'revoke'
                ? 'Ce lien ne permettra plus d’activer le compte.'
                : 'Le lien précédent ne sera plus utilisable.'}
          </p>
        )}
        {pending && <p role="status">Traitement en cours…</p>}
        <footer>
          <button type="button" disabled={pending} onClick={close}>
            Annuler
          </button>
          <Button disabled={pending}>
            {invite
              ? 'Envoyer l’invitation'
              : dialog.kind === 'role'
                ? 'Confirmer le rôle'
                : dialog.kind === 'deactivate'
                  ? 'Confirmer la désactivation'
                  : dialog.kind === 'revoke'
                    ? 'Confirmer la révocation'
                    : 'Confirmer le renvoi'}
          </Button>
        </footer>
      </form>
    </dialog>
  )
}
