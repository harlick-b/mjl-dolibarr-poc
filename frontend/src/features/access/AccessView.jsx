import { Urls } from '@/app/urls'
import { Select } from '@/shared/ui/select'
import { ListFilters } from '@/shared/ui/ListFilters'
import { EmptyTable } from '@/shared/ui/EmptyContent'
import { AdminShell, AdminMain } from '@/shared/ui/layout'
import { cursorFrom } from '@/shared/lib/pagination'
import { RetryableError } from '@/shared/ui/RetryableError'
import { useSessionQuery } from '@/features/auth/session/SessionProvider'
import {
  authorization,
  roleLabels,
} from '@/features/auth/session/authorization'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, X, LoaderCircle } from 'lucide-react'
import { sessionKey } from '@/features/auth/session/auth'
import { useAPI } from '@/shared/api/RestClientProvider'
import { strings } from '@/locales/fr/AccessView'
import { strings as common } from '@/locales/fr/common'
import { Button } from '@/shared/ui/button'
import { Modal } from '@/shared/ui/BusinessModal'
import { Helmet } from 'react-helmet-async'
import { ApplicationSidebar } from '@/features/auth/components/ApplicationSidebar'
import { EmptyState } from '@/shared/ui/FallbackState'
import { PageLoading, RefreshIndicator } from '@/shared/ui/PageLoading'
import { useAccess } from '@/features/auth/session/access-verification'
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'
import { toast } from 'sonner'

const states = {
  pending: 'En attente',
  active: 'Actif',
  inactive: 'Inactif',
  prepared: 'En préparation',
  delivered: 'Envoyée',
  consumed: 'Acceptée',
  revoked: 'Révoquée',
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
    placeholderData: (previousData) => previousData,
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
  const search = useSearch({ from: Urls.accessUsers })
  const [dialog, setDialog] = useState(
    search.invite ? { kind: 'invite' } : null,
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
    ...(search.q ? { q: search.q } : {}),
    ...(search.role ? { role: search.role } : {}),
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
    navigate({ to: Urls.accessUsers, search: { ...search, ...values } })
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
      const message =
        dialog.kind === 'role'
          ? result.version === dialog.item.version
            ? 'Rôle inchangé.'
            : 'Rôle modifié. Une nouvelle connexion est nécessaire.'
          : dialog.kind === 'deactivate'
            ? 'Compte désactivé.'
            : dialog.kind === 'revoke'
              ? 'Invitation révoquée.'
              : 'Invitation envoyée.'
      if (dialog.kind === 'invite') toast.success(message)
      else setNotice(message)
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
        await client.invalidateQueries({ queryKey: ['audit-history'] })
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
          <section
            className="overflow-hidden rounded-panel border border-border bg-white"
            aria-busy={users.isFetching}
          >
            <ListFilters
              value={search.q}
              onSearch={(q) => void changeSearch({ q: q.trim(), page: 1 })}
              label={strings.userSearchPlaceholder}
              active={Boolean(search.role)}
              onReset={() => void changeSearch({ q: '', role: '', page: 1 })}
              disabled={users.isPending}
              showReset={false}
            >
              <label>
                {strings.roleFilter}
                <Select
                  value={search.role}
                  onChange={(event) =>
                    void changeSearch({ role: event.target.value, page: 1 })
                  }
                >
                  <option value="">{strings.allRoles}</option>
                  {Object.entries(roleLabels).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
            </ListFilters>
            {(search.q || search.role) && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-[0.8125rem]">
                {search.q && (
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center gap-2 rounded-card border border-border bg-white px-3"
                    onClick={() => void changeSearch({ q: '', page: 1 })}
                  >
                    {strings.formatString(strings.searchCriterion, {
                      query: search.q,
                    })}
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
                {search.role && (
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center gap-2 rounded-card border border-border bg-white px-3"
                    onClick={() => void changeSearch({ role: '', page: 1 })}
                  >
                    {roleLabels[search.role]}
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  className="min-h-8 text-primary"
                  onClick={() =>
                    void changeSearch({ q: '', role: '', page: 1 })
                  }
                >
                  {strings.resetFilters}
                </button>
              </div>
            )}
            {!users.isError && users.data && (
              <p className="flex items-center border-b border-border px-4 py-4 text-sm font-medium">
                <span>
                  {strings.formatString(
                    users.data.total === 1
                      ? strings.userCount
                      : strings.usersCount,
                    { count: users.data.total },
                  )}
                </span>
                <RefreshIndicator
                  active={users.isFetching && !users.isPending}
                />
              </p>
            )}
            <ListState
              query={users}
              empty={
                search.q || search.role ? (
                  <EmptyState
                    action={
                      <button
                        className="min-h-10 border border-border rounded-control py-2 px-4 bg-white text-navy font-medium"
                        onClick={() =>
                          void changeSearch({
                            q: '',
                            role: '',
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
              <div className="relative overflow-auto bg-white">
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
                          {invitationStatus(u, users.dataUpdatedAt) && (
                            <small className="block mt-1 text-muted-foreground">
                              {invitationStatus(u, users.dataUpdatedAt)}
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
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      type="button"
                                      disabled={
                                        mutation.isPending || users.isFetching
                                      }
                                      onClick={() =>
                                        setDialog({ kind: 'role', item: u })
                                      }
                                    >
                                      Modifier le rôle
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    disabled={
                                      mutation.isPending || users.isFetching
                                    }
                                    onClick={() =>
                                      setDialog({ kind: 'deactivate', item: u })
                                    }
                                  >
                                    Désactiver
                                  </Button>
                                </>
                              )}
                            {u.invitation &&
                              u.role !== 'ADMIN_PLATEFORME' &&
                              ['prepared', 'delivered'].includes(
                                u.invitation.state,
                              ) && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    disabled={
                                      mutation.isPending || users.isFetching
                                    }
                                    onClick={() =>
                                      setDialog({
                                        kind: 'resend',
                                        item: {
                                          ...u.invitation,
                                          email: u.email,
                                        },
                                      })
                                    }
                                  >
                                    Renvoyer
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    disabled={
                                      mutation.isPending || users.isFetching
                                    }
                                    onClick={() =>
                                      setDialog({
                                        kind: 'revoke',
                                        item: {
                                          ...u.invitation,
                                          email: u.email,
                                        },
                                      })
                                    }
                                  >
                                    Révoquer
                                  </Button>
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
          </section>
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
              close={() => setDialog(null)}
              submit={submit}
            />
          )}
        </AdminMain>
      </div>
    </AdminShell>
  )
}

function invitationStatus(user, updatedAt) {
  if (!user.invitation) return ''
  if (user.invitation.state === 'revoked') return 'Révoquée'
  if (
    Date.parse(user.invitation.expires_at) <= updatedAt &&
    user.invitation.state !== 'revoked'
  )
    return 'Expirée'
  if (user.invitation.delivery_status === 'failed') return 'Envoi échoué'
  if (user.invitation.delivery_status === 'unconfirmed')
    return 'Envoi non confirmé'
  return ''
}

function ListState({ query, empty, children }) {
  if (query.isPending)
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
function AccessDialog({ dialog, pending, close, submit }) {
  const { api } = useAPI()
  const session = useSessionQuery()
  const [partnerCursor, setPartnerCursor] = useState('')
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
    <Modal
      open
      onClose={close}
      label={title}
      closeDisabled={pending}
      className="[&_label]:grid [&_label]:gap-2 [&_label]:text-[0.8125rem] [&_input]:min-h-11 [&_input]:max-w-full [&_input]:rounded-control [&_input]:border [&_input]:border-border [&_input]:bg-white [&_input]:px-3 [&_input]:py-2 [&_select]:min-h-11 [&_select]:max-w-full [&_select]:rounded-control [&_select]:border [&_select]:border-border [&_select]:bg-white [&_select]:px-3 [&_select]:py-2 [&_button:disabled]:cursor-not-allowed"
    >
      <form
        onSubmit={(event) => {
          if (optionsBlocked) event.preventDefault()
          else submit(event)
        }}
        aria-busy={pending}
      >
        <fieldset disabled={pending}>
          {invite ? (
            <div className="grid gap-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  {strings.firstName} *
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
                  {strings.lastName} *
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
                Adresse e-mail *
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
                    Partenaire *
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
            <div className="grid gap-6">
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
        <footer data-ui="modal-actions">
          <Button
            variant="outline"
            type="button"
            disabled={pending}
            onClick={close}
          >
            Annuler
          </Button>
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
    </Modal>
  )
}
