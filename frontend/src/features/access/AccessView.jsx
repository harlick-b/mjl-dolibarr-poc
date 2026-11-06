import { outsideDialog } from '@/shared/ui/dialog-events'
import { Select } from '@/shared/ui/select'
import { EmptyTable } from '@/shared/ui/EmptyContent'
import { AdminShell, AdminMain } from '@/shared/ui/layout'
import { cursorFrom } from '@/shared/lib/pagination'
import { RetryableError } from '@/shared/ui/RetryableError'
import { useSessionQuery } from '@/features/auth/SessionProvider'
import { authorization, roleLabels } from '@/features/auth/authorization'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, SlidersHorizontal, X, LoaderCircle } from 'lucide-react'
import { sessionKey } from '@/features/auth/auth'
import { useAPI } from '@/shared/api/RestClientProvider'
import { strings } from '@/locales/fr/AccessView'
import { strings as common } from '@/locales/fr/common'
import { Button } from '@/shared/ui/button'
import { Helmet } from 'react-helmet-async'
import { ApplicationSidebar } from '@/features/auth/ApplicationSidebar'
import { EmptyState } from '@/shared/ui/FallbackState'
import { PageLoading } from '@/shared/ui/PageLoading'
import { useAccess } from '@/features/auth/access-verification'
import { AccessDeniedState } from '@/features/auth/AccessDeniedState'

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
  const sessionQuery = useSessionQuery()
  const access = useAccess()
  const session = access.session ?? sessionQuery.data
  const user = session?.user
  if (access.status !== 'verified' || session?.state !== 'verified' || !user)
    return <AccessLoading />
  if (!authorization(session).can('accounts'))
    return <AccessDeniedState role={user.role} />
  return <Accounts key={user.id} session={session} />
}

export function AccessGate({ children }) {
  const session = useSessionQuery()
  const user =
    !session.isError &&
    session.data?.state === 'verified' &&
    session.data.user.role === 'ADMIN_PLATEFORME'
      ? session.data.user
      : null
  return (
    <AdminShell>
      <Helmet>
        <title>{common.usersTitle}</title>
      </Helmet>
      <ApplicationSidebar user={user} />
      <div data-ui="access-workspace">
        <AdminMain>{children}</AdminMain>
      </div>
    </AdminShell>
  )
}

export function AccessLoading() {
  return (
    <AccessGate>
      <PageLoading title={common.usersTitle} />
    </AccessGate>
  )
}

function listQuery(api, principal, kind, filters, onDenied) {
  return {
    queryKey: ['access', principal, kind, filters],
    retry: false,
    networkMode: 'always',
    queryFn: async ({ signal }) => {
      try {
        const result = await api.request(
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
        if (error.status === 401) onDenied(error.status)
        throw error
      }
    },
  }
}

async function partnerOptions(api, signal, requiredIds) {
  const data = []
  let path = '/api/v1/partners?limit=100'
  const seen = new Set()
  while (path) {
    if (seen.has(path)) throw new Error('Pagination des Partenaires invalide.')
    seen.add(path)
    const page = await api.request(path, { signal })
    if (!Array.isArray(page.data))
      throw new Error('Liste des Partenaires invalide.')
    data.push(
      ...page.data.filter((partner) => requiredIds.includes(partner.id)),
    )
    if (requiredIds.every((id) => data.some((partner) => partner.id === id)))
      break
    if (!page.next) break
    const next = new URL(page.next, window.location.origin)
    if (
      next.origin !== window.location.origin ||
      next.pathname !== '/api/v1/partners'
    )
      throw new Error('Pagination des Partenaires invalide.')
    path = `${next.pathname}${next.search}`
  }
  return data
}

function Accounts({ session, onDenied = () => {}, checking }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ from: '/access/users' })
  const [dialog, setDialog] = useState(
    search.invite ? { kind: 'invite' } : null,
  )
  const [filtersOpen, setFiltersOpen] = useState(
    Boolean(search.email || search.role || search.state),
  )
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const alive = useRef(true)
  const controller = useRef(null)
  const mutation = useMutation({
    retry: false,
    networkMode: 'always',
    meta: { localError: true },
    mutationFn: ({ path, body, signal, method }) =>
      api.request(`/api/v1/access/${path}`, {
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
  const users = useQuery(
    listQuery(api, session.user.id, 'users', userFilters, denied),
  )
  const partnerIds = [
    ...new Set(
      (users.data?.items || [])
        .filter((user) => user.role === 'PARTENAIRE')
        .map((user) => user.partner_id),
    ),
  ].sort()
  const partners = useQuery({
    queryKey: ['access', session.user.id, 'partners', partnerIds],
    retry: false,
    networkMode: 'always',
    enabled: partnerIds.length > 0,
    queryFn: async ({ signal }) => {
      try {
        return await partnerOptions(api, signal, partnerIds)
      } catch (error) {
        if (error.status === 401) denied(error.status)
        throw error
      }
    },
  })
  const changeSearch = (values) =>
    navigate({ to: '/access/users', search: { ...search, ...values } })
  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    const data = new FormData(event.currentTarget)
    if (dialog.kind === 'invite') {
      const name = `${data.get('first_name').trim()} ${data.get('last_name').trim()}`
      if (
        !data.get('first_name').trim() ||
        !data.get('last_name').trim() ||
        name.length > 200
      ) {
        const input = event.currentTarget.elements.namedItem('last_name')
        input.setCustomValidity(strings.nameValidation)
        input.reportValidity()
        return
      }
    }
    const lifecycle = ['role', 'deactivate'].includes(dialog.kind)
    const path = lifecycle
      ? `users/${dialog.item.id}`
      : dialog.kind === 'invite'
        ? 'invitations'
        : `invitations/${dialog.item.id}/${dialog.kind}`
    const role = data.get('role')
    const body =
      dialog.kind === 'invite'
        ? {
            email: data.get('email'),
            full_name: `${data.get('first_name').trim()} ${data.get('last_name').trim()}`,
            first_name: data.get('first_name').trim(),
            last_name: data.get('last_name').trim(),
            role,
            ...(role === 'PARTENAIRE'
              ? { partner_id: data.get('partner_id') }
              : {}),
          }
        : {
            expected_version: dialog.item.version,
            ...(dialog.kind === 'role' ? { role: data.get('role') } : {}),
            ...(dialog.kind === 'deactivate' ? { deactivate: true } : {}),
          }
    setNotice('')
    setSubmitting(true)
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
    } catch (error) {
      if (!alive.current) return
      if (error.status === 401) {
        denied(error.status)
        return
      }
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
        if (alive.current) {
          setSubmitting(false)
          setDialog(null)
          reset()
        }
      }
    }
  }
  return (
    <AdminShell
      className="data-[checking]:hidden!"
      inert={checking || undefined}
      data-checking={checking || undefined}
    >
      <Helmet>
        <title>{common.usersTitle}</title>
      </Helmet>
      <ApplicationSidebar user={session.user} />
      <div data-ui="access-workspace">
        <AdminMain>
          <div
            className="flex flex-wrap items-center justify-between gap-4 mb-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold"
            data-ui="access-heading"
          >
            <h1>Utilisateurs</h1>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal aria-hidden="true" size={16} />
                <span className="sr-only">{strings.usersFilters}</span>
              </Button>
              <Button onClick={() => setDialog({ kind: 'invite' })}>
                <Plus size={18} />
                Inviter un utilisateur
              </Button>
            </div>
          </div>
          {notice && (
            <p
              role="status"
              className="p-4 border border-border rounded-card bg-white mb-4"
            >
              {notice}
            </p>
          )}
          {filtersOpen && (
            <div>
              <form
                className="flex items-end flex-wrap gap-4 mb-6 max-[761px]:[&_>_label]:w-full"
                data-ui="access-filters"
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
                  <Select
                    key={search.role}
                    name="role"
                    defaultValue={search.role}
                  >
                    <option value="">Tous les rôles</option>
                    {Object.entries(roleLabels).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label>
                  État du compte
                  <Select
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
                  </Select>
                </label>
                <Button>Filtrer</Button>
              </form>
            </div>
          )}
          <ListState
            query={users}
            empty={
              search.email || search.role || search.state ? (
                <EmptyState
                  action={
                    <button
                      className="min-h-10 border border-border rounded-control py-2 px-4 bg-white text-navy font-medium"
                      onClick={() =>
                        void changeSearch({
                          email: '',
                          role: '',
                          state: '',
                          page: 1,
                        })
                      }
                      type="button"
                    >
                      Effacer les filtres
                    </button>
                  }
                >
                  <p>{strings.noMatches}</p>
                </EmptyState>
              ) : (
                <EmptyTable
                  kind="users"
                  columns={['name', 'role', 'scope', 'state']}
                />
              )
            }
          >
            <div className="relative border border-border rounded-card overflow-auto bg-white [&_+_[data-ui~='access-heading']]:mt-8">
              <table>
                <caption className="sr-only">Comptes utilisateurs</caption>
                <thead>
                  <tr>
                    <th>{strings.userName}</th>
                    <th>Rôle</th>
                    <th>{strings.userScope}</th>
                    <th>État</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.data?.items.map((u) => (
                    <tr key={u.id}>
                      <td className="[&_strong]:font-medium [&_small]:text-xs">
                        <strong>{u.full_name || u.email}</strong>
                        {u.full_name && (
                          <small className="block mt-1 text-muted-foreground">
                            {u.email}
                          </small>
                        )}
                      </td>
                      <td>{roleLabels[u.role]}</td>
                      <td>
                        {u.role === 'PARTENAIRE'
                          ? partners.data?.find(
                              (partner) => partner.id === u.partner_id,
                            )?.name || strings.partnerScope
                          : 'MJL'}
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center gap-1 min-h-5 bg-warning-soft text-warning py-1 px-2 rounded-card text-xs [&[data-state='active']]:bg-success-badge [&[data-state='active']]:text-success [&[data-state='inactive']]:bg-disabled [&[data-state='inactive']]:text-muted-foreground"
                          data-state={u.state}
                        >
                          {states[u.state]}
                        </span>
                        {u.invitation && (
                          <small className="block mt-1 text-muted-foreground">
                            {states[u.invitation.state]} ·{' '}
                            {deliveryLabels[u.invitation.delivery_status]}
                            {Date.parse(u.invitation.expires_at) <=
                              users.dataUpdatedAt &&
                            u.invitation.state !== 'revoked'
                              ? ' · Expirée'
                              : ''}
                          </small>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-3 text-primary">
                          {u.state === 'active' &&
                            u.role !== 'ADMIN_PLATEFORME' &&
                            u.id !== session.user.id && (
                              <>
                                {u.role !== 'PARTENAIRE' && (
                                  <button
                                    type="button"
                                    disabled={
                                      mutation.isPending || users.isFetching
                                    }
                                    onClick={() =>
                                      setDialog({ kind: 'role', item: u })
                                    }
                                  >
                                    Modifier le rôle
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={
                                    mutation.isPending || users.isFetching
                                  }
                                  onClick={() =>
                                    setDialog({ kind: 'deactivate', item: u })
                                  }
                                >
                                  Désactiver
                                </button>
                              </>
                            )}
                          {u.invitation &&
                            u.role !== 'ADMIN_PLATEFORME' &&
                            ['prepared', 'delivered'].includes(
                              u.invitation.state,
                            ) && (
                              <>
                                <button
                                  type="button"
                                  disabled={
                                    mutation.isPending || users.isFetching
                                  }
                                  onClick={() =>
                                    setDialog({
                                      kind: 'resend',
                                      item: { ...u.invitation, email: u.email },
                                    })
                                  }
                                >
                                  Renvoyer
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    mutation.isPending || users.isFetching
                                  }
                                  onClick={() =>
                                    setDialog({
                                      kind: 'revoke',
                                      item: { ...u.invitation, email: u.email },
                                    })
                                  }
                                >
                                  Révoquer
                                </button>
                              </>
                            )}
                        </div>
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
          {dialog && (
            <AccessDialog
              dialog={dialog}
              pending={submitting}
              checking={checking}
              close={() => setDialog(null)}
              submit={submit}
            />
          )}
        </AdminMain>
      </div>
    </AdminShell>
  )
}

function ListState({ query, empty, children }) {
  if (query.isPending || query.isFetching)
    return (
      <div
        className="grid gap-3 p-4 mb-6 border border-border bg-white rounded-panel [&_span]:block [&_span]:h-10 [&_span]:bg-disabled [&_span]:rounded"
        role="status"
        aria-label={strings.adminListLoading}
      >
        <span />
        <span />
        <span />
      </div>
    )
  if (query.isError)
    return (
      <section
        className="p-6 border border-border rounded-panel bg-background grid justify-items-start gap-4 [&_h3]:font-semibold [&_>_p]:text-muted-foreground"
        role="alert"
      >
        <h3>{strings.listUnavailable}</h3>
        <p>{strings.listRetryPrompt}</p>
        <Button onClick={() => query.refetch()}>{strings.listRetry}</Button>
      </section>
    )
  return query.data?.items.length ? (
    children
  ) : typeof empty === 'string' ? (
    <p className="p-4 border border-border rounded-card bg-white mb-4">
      {empty}
    </p>
  ) : (
    empty
  )
}
function Pagination({ query, page, change, label }) {
  if (!query.data || query.isError || (page === 1 && query.data.total <= 20))
    return null
  return (
    <nav
      className="[&_button]:min-h-11 [&_button]:text-primary [&_button]:underline flex justify-end flex-wrap items-center gap-4 mt-3 mr-0 mb-10 ml-0 text-[0.8125rem]"
      aria-label={`Pagination ${label}`}
    >
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
  const { api } = useAPI()
  const session = useSessionQuery()
  const [partnerCursor, setPartnerCursor] = useState('')
  const ref = useRef(null)
  const outside = useRef(false)
  const [inviteRole, setInviteRole] = useState('AGENT_SAISIE')
  const partners = useQuery({
    queryKey: [
      'access',
      session.data.user.id,
      'partner-options',
      partnerCursor,
    ],
    queryFn: ({ signal }) =>
      api.request(
        `/api/v1/partners?limit=60${partnerCursor ? `&cursor=${encodeURIComponent(partnerCursor)}` : ''}`,
        { signal },
      ),
    enabled: dialog.kind === 'invite' && inviteRole === 'PARTENAIRE',
    retry: false,
    gcTime: 0,
    networkMode: 'always',
  })
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
  const optionsBlocked =
    invite &&
    inviteRole === 'PARTENAIRE' &&
    (partners.isPending || partners.isFetching || partners.isError)
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
      className="data-[checking]:hidden! [&_label]:grid [&_label]:gap-2 [&_label]:text-[0.8125rem] [&_input]:min-h-11 [&_input]:border [&_input]:border-border [&_input]:rounded-control [&_input]:py-2 [&_input]:px-3 [&_input]:bg-white [&_input]:max-w-full [&_select]:min-h-11 [&_select]:border [&_select]:border-border [&_select]:rounded-control [&_select]:py-2 [&_select]:px-3 [&_select]:bg-white [&_select]:max-w-full [&_button]:min-h-11 [&_button:disabled]:opacity-50 [&_button:disabled]:cursor-not-allowed m-auto p-0 w-[min(560px,_calc(100%_-_32px))] border border-border rounded-panel max-h-[calc(100vh_-_32px)] overflow-auto text-foreground [&::backdrop]:bg-overlay [&_>_[data-ui~='access-heading']]:m-0 [&_>_[data-ui~='access-heading']]:py-4 [&_>_[data-ui~='access-heading']]:px-6 [&_>_[data-ui~='access-heading']]:border-b [&_>_[data-ui~='access-heading']]:border-b-border [&_h2]:text-xl [&_h2]:font-semibold [&_fieldset_>_p]:p-6 [&_footer]:flex [&_footer]:justify-end [&_footer]:flex-wrap [&_footer]:items-center [&_footer]:gap-4 [&_footer]:py-4 [&_footer]:px-6 [&_footer]:border-t [&_footer]:border-t-border [&_footer_button[type='button']]:border [&_footer_button[type='button']]:border-strong-border [&_footer_button[type='button']]:py-2 [&_footer_button[type='button']]:px-4 [&_footer_button[type='button']]:rounded-control"
      inert={checking || undefined}
      data-checking={checking || undefined}
      onPointerDown={(event) => {
        outside.current = outsideDialog(event)
      }}
      onClick={(event) => {
        if (outside.current && outsideDialog(event)) close()
      }}
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
      <div
        className="flex flex-wrap items-center justify-between gap-4 mb-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold"
        data-ui="access-heading"
      >
        <h2 id="invitation-title">{title}</h2>
        <button aria-label="Fermer" disabled={pending} onClick={close}>
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={(event) => {
          if (optionsBlocked) event.preventDefault()
          else submit(event)
        }}
        aria-busy={pending}
      >
        <fieldset disabled={pending}>
          {invite ? (
            <div className="grid gap-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  {strings.firstName}
                  <input
                    name="first_name"
                    onInput={(event) =>
                      event.currentTarget.form.elements
                        .namedItem('last_name')
                        .setCustomValidity('')
                    }
                    type="text"
                    maxLength={100}
                    required
                    autoComplete="given-name"
                  />
                </label>
                <label>
                  {strings.lastName}
                  <input
                    name="last_name"
                    onInput={(event) =>
                      event.currentTarget.setCustomValidity('')
                    }
                    type="text"
                    maxLength={100}
                    required
                    autoComplete="family-name"
                  />
                </label>
              </div>
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
                <Select
                  name="role"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value)}
                >
                  {Object.entries(roleLabels)
                    .filter(([r]) => r !== 'ADMIN_PLATEFORME')
                    .map(([r, l]) => (
                      <option key={r} value={r}>
                        {l}
                      </option>
                    ))}
                </Select>
              </label>
              {inviteRole === 'PARTENAIRE' && (
                <div>
                  <label>
                    Partenaire
                    <Select
                      name="partner_id"
                      required
                      disabled={partners.isPending}
                    >
                      <option value="">{strings.selectPartner}</option>
                      {partners.data?.data
                        .filter((partner) => partner.active)
                        .map((partner) => (
                          <option key={partner.id} value={partner.id}>
                            {partner.name}
                          </option>
                        ))}
                    </Select>
                  </label>
                  {partners.isError && (
                    <RetryableError onRetry={() => void partners.refetch()}>
                      Liste des Partenaires indisponible.
                    </RetryableError>
                  )}
                  <span className="flex gap-2 items-end flex-wrap">
                    <Button
                      type="button"
                      disabled={!partners.data?.previous || partners.isFetching}
                      onClick={() =>
                        setPartnerCursor(
                          cursorFrom(partners.data.previous, '/partners'),
                        )
                      }
                    >
                      Précédent
                    </Button>
                    <Button
                      type="button"
                      disabled={!partners.data?.next || partners.isFetching}
                      onClick={() =>
                        setPartnerCursor(
                          cursorFrom(partners.data.next, '/partners'),
                        )
                      }
                    >
                      Suivant
                    </Button>
                  </span>
                </div>
              )}
            </div>
          ) : dialog.kind === 'role' ? (
            <div className="grid gap-6 p-6">
              <p>{dialog.item.email}</p>
              <label>
                Nouveau rôle
                <Select name="role" defaultValue={dialog.item.role}>
                  {Object.entries(roleLabels)
                    .filter(
                      ([role]) =>
                        !['ADMIN_PLATEFORME', 'PARTENAIRE'].includes(role),
                    )
                    .map(([role, label]) => (
                      <option key={role} value={role}>
                        {label}
                      </option>
                    ))}
                </Select>
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
        </fieldset>
        <footer>
          <button type="button" disabled={pending} onClick={close}>
            Annuler
          </button>
          <Button disabled={pending || optionsBlocked} aria-busy={pending}>
            {pending && (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            )}
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
