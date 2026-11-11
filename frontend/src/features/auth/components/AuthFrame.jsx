import { Helmet } from 'react-helmet-async'
import { LoaderCircle } from 'lucide-react'
import { ApplicationSidebar } from './ApplicationSidebar'
import { AuthCard } from './AuthCard'
import { PageLoading } from '@/shared/ui/PageLoading'
import { buttonVariants } from '@/shared/ui/button-variants'
import { cn } from '@/shared/lib/utils'
import { strings } from '@/locales/fr/AuthView'
import { strings as common } from '@/locales/fr/common'
import { authTitle } from '../lib/auth-title'

export function AuthFrame({ user, title, busy, children, loading = false }) {
  return (
    <div
      className={
        user
          ? 'grid grid-cols-[256px_minmax(0,_1fr)] min-h-screen [&_small]:block [&_small]:text-muted-foreground [&_small]:mt-1 max-[761px]:grid-cols-[minmax(0,_1fr)]'
          : 'min-h-dvh grid grid-cols-[min(360px,_24%)_minmax(0,_1fr)] max-[761px]:grid-cols-1'
      }
      data-ui={user ? 'access-layout' : 'auth-layout'}
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>
      {user ? (
        <ApplicationSidebar user={user} />
      ) : (
        <aside
          className="relative overflow-hidden bg-navy max-[761px]:hidden"
          data-ui="auth-brand"
          aria-hidden="true"
        >
          {[
            'top-[20%] left-[15%]',
            'top-[30%] left-[30%]',
            'top-[40%] left-[45%]',
            'top-[50%] left-[60%]',
          ].map((position) => (
            <span
              key={position}
              className={cn(
                'absolute h-[110%] w-[110%] -rotate-12 rounded-t-[999px] border border-support/25 bg-linear-to-r from-support/20 to-transparent',
                position,
              )}
            />
          ))}
        </aside>
      )}
      <main
        className={cn(
          'grid min-w-0 gap-8 px-8 py-6 max-[761px]:gap-6 max-[761px]:px-4',
          user ? 'grid-rows-1' : 'grid-rows-[auto_1fr]',
        )}
      >
        {!user && (
          <header className="flex items-center gap-3 text-2xl leading-8 text-navy">
            <img
              className="rounded-control"
              src="/icon-192.png"
              alt=""
              width="36"
              height="36"
            />
            <strong>MJL</strong>
          </header>
        )}
        {loading ? children : <AuthCard busy={busy}>{children}</AuthCard>}
      </main>
    </div>
  )
}

export function AuthLoading({ path }) {
  return (
    <AuthFrame title={authTitle(path)} busy loading>
      <PageLoading title={authTitle(path)} className="min-h-0 h-full" />
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
        className="grid gap-4 [&_p]:m-0 [&_[data-ui~='auth-primary']]:mt-2"
        role={failed ? 'alert' : 'status'}
        aria-label={failed ? undefined : strings.verificationTitle}
        aria-busy={failed ? undefined : 'true'}
      >
        <div className="flex items-center gap-3">
          {!failed && (
            <LoaderCircle
              className="text-primary animate-spin [animation-duration:0.8s]"
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
          <button
            className={buttonVariants({ variant: 'auth' })}
            data-ui="auth-primary"
            onClick={onRetry}
            type="button"
          >
            {common.retry}
          </button>
        )}
      </div>
    </AuthFrame>
  )
}
