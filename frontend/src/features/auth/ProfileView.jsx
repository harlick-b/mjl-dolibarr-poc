import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAccess } from './access-verification'
import { roleLabels } from './authorization'
import { useAPI } from '@/shared/api/RestClientProvider'
import { Panel } from '@/shared/ui/layout'
import { Button } from '@/shared/ui/button'
import { LoadingPlaceholder } from '@/shared/ui/PageLoading'
import { RetryableError } from '@/shared/ui/RetryableError'
import { strings } from '@/locales/fr/ProfileView'

export function ProfileView() {
  const access = useAccess()
  const { api } = useAPI()
  const query = useQuery({
    queryKey: ['profile', access.user.id],
    queryFn: async ({ signal }) => {
      const result = await api.request('/api/v1/auth/profile', { signal })
      if (
        !result ||
        typeof result.email !== 'string' ||
        !roleLabels[result.role] ||
        ['full_name', 'first_name', 'last_name'].some(
          (key) => result[key] !== null && typeof result[key] !== 'string',
        )
      )
        throw new Error(strings.unavailable)
      return result
    },
  })
  return (
    <section className="mx-auto w-full max-w-180 grid gap-6">
      <Helmet>
        <title>{strings.title} — MJL</title>
      </Helmet>
      <h1 className="text-2xl font-semibold text-navy">{strings.title}</h1>
      {query.isPending ? (
        <LoadingPlaceholder label={strings.title} variant="form" />
      ) : query.isError && !query.data ? (
        <RetryableError onRetry={() => query.refetch()}>
          {strings.unavailable}
        </RetryableError>
      ) : (
        <>
          {query.isError && (
            <RetryableError onRetry={() => query.refetch()}>
              {strings.unavailable}
            </RetryableError>
          )}
          <ProfileForm
            key={access.user.id}
            profile={query.data}
            onReload={() => query.refetch({ throwOnError: true })}
          />
        </>
      )}
    </section>
  )
}

function ProfileForm({ profile, onReload }) {
  const access = useAccess()
  const client = useQueryClient()
  const { api } = useAPI()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const alive = useRef(true)
  const controller = useRef(null)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      controller.current?.abort()
    }
  }, [])
  const legacyWords = (profile.full_name || '').trim().split(/\s+/)
  const initialNames = {
    first_name: profile.first_name ?? legacyWords[0] ?? '',
    last_name: profile.last_name ?? legacyWords.slice(1).join(' '),
  }
  const names = draft ?? initialNames
  const mutation = useMutation({
    meta: { localError: true },
    mutationFn: (body) =>
      api.request('/api/v1/auth/profile', {
        method: 'PATCH',
        body,
        csrf: access.session.csrf,
        signal: controller.current?.signal,
      }),
  })
  const changed =
    names.first_name.trim() !== initialNames.first_name ||
    names.last_name.trim() !== initialNames.last_name
  useEffect(() => {
    document.documentElement.dataset.authBusy = String(
      changed || mutation.isPending,
    )
    return () => {
      delete document.documentElement.dataset.authBusy
    }
  }, [changed, mutation.isPending])
  const words = (profile.full_name || profile.email).trim().split(/\s+/)
  const initials = [words[0], ...(words.length > 1 ? [words.at(-1)] : [])]
    .map((word) => Array.from(word)[0])
    .join('')
    .toLocaleUpperCase('fr')
  async function save(event) {
    event.preventDefault()
    if (mutation.isPending) return
    setError('')
    setConflict(false)
    controller.current = new AbortController()
    try {
      const result = await mutation.mutateAsync({
        first_name: names.first_name,
        last_name: names.last_name,
        expected: draft?.expected ?? {
          full_name: profile.full_name,
          first_name: profile.first_name,
          last_name: profile.last_name,
        },
      })
      if (!alive.current) return
      access.updateDisplayName(access.user.id, result.full_name)
      client.setQueryData(['profile', access.user.id], result)
      await client.invalidateQueries({ queryKey: ['access'] })
      if (!alive.current) return
      setDraft(null)
      toast.success(strings.saved)
    } catch (failure) {
      if (!alive.current || failure.name === 'AbortError') return
      setError(failure.status === 409 ? strings.conflict : strings.failed)
      setConflict(failure.status === 409)
    }
  }
  return (
    <>
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-selected text-xs font-semibold text-primary"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="font-semibold break-words">
            {profile.full_name || profile.email}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {roleLabels[profile.role]}
          </p>
        </div>
      </div>
      <Panel className="p-0 gap-0">
        <h2 className="border-b border-border p-5">{strings.personal}</h2>
        <form className="grid gap-6 p-5" onSubmit={save}>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              ['first_name', strings.firstName, 'given-name'],
              ['last_name', strings.lastName, 'family-name'],
            ].map(([field, label, complete]) => (
              <label key={field}>
                {label}
                <input
                  name={field}
                  autoComplete={complete}
                  maxLength={100}
                  required
                  disabled={mutation.isPending}
                  value={names[field]}
                  onChange={(event) =>
                    setDraft({
                      ...names,
                      [field]: event.target.value,
                      expected: draft?.expected ?? {
                        full_name: profile.full_name,
                        first_name: profile.first_name,
                        last_name: profile.last_name,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label>
            {strings.email}
            <input
              value={profile.email}
              readOnly
              className="bg-background! text-muted-foreground"
            />
          </label>
          <label>
            {strings.role}
            <input
              value={roleLabels[profile.role]}
              readOnly
              className="bg-background! text-muted-foreground"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {conflict && (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await onReload()
                  if (!alive.current) return
                  setDraft(null)
                  setConflict(false)
                  setError('')
                } catch {
                  if (alive.current) setError(strings.unavailable)
                }
              }}
            >
              {strings.reload}
            </Button>
          )}
          <Button
            variant="outline"
            className="justify-self-end"
            disabled={
              !changed ||
              !names.first_name.trim() ||
              !names.last_name.trim() ||
              mutation.isPending
            }
            aria-busy={mutation.isPending}
          >
            {mutation.isPending && (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {strings.save}
          </Button>
        </form>
      </Panel>
    </>
  )
}
