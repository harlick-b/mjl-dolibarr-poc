import { AccessView } from './AccessView'
import { AuthView } from './AuthView'
import { sessionQuery } from './auth'
import { useRouterState } from '@tanstack/react-router'
import { HealthView } from './HealthView'
import { PlanningView } from './PlanningView'
import { healthQuery } from './health'
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster, toast } from 'sonner'
import { RestClientProvider } from './RestClientProvider'
import { api } from './rest-client'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'

function Shell() {
  const path = useRouterState({ select: (state) => state.location.pathname })
  if (
    [
      '/login',
      '/invitation',
      '/verification',
      '/identity',
      '/forgot-password',
      '/reset-password',
      '/access/users',
    ].includes(path)
  )
    return <Outlet />
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-6 px-6 py-5">
          <Link
            to="/"
            className="flex items-center gap-3 font-semibold text-navy"
            aria-label="MJL — accueil"
          >
            <img src="/icon-192.png" alt="" width="36" height="36" /> MJL
          </Link>
          <nav
            aria-label="Navigation principale"
            className="flex gap-6 text-sm"
          >
            <Link
              to="/"
              activeProps={{
                'aria-current': 'page',
                className: 'font-semibold',
              }}
            >
              Accueil
            </Link>
            <Link
              to="/health"
              activeProps={{
                'aria-current': 'page',
                className: 'font-semibold',
              }}
            >
              État du service
            </Link>
            <Link to="/projects">Planification</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Outlet />
      </main>
    </div>
  )
}

function Home() {
  return (
    <section className="rounded-card border border-border bg-white p-8">
      <h1 className="text-2xl font-semibold text-navy">Espace MJL</h1>
      <p className="mt-4 text-muted-foreground">
        L’espace de travail est en préparation.
      </p>
      <Link to="/login" className="mt-6 mr-6 inline-block underline">
        Se connecter
      </Link>
      <Link to="/health" className="mt-6 inline-block underline">
        Vérifier la disponibilité du service
      </Link>
    </section>
  )
}

function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <Link to="/" className="mt-4 inline-block underline">
        Retour à l’accueil
      </Link>
    </section>
  )
}

export function makeRouter(history) {
  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.options.meta?.localError && error?.name !== 'AbortError')
          toast.error(error?.message || 'Une action a échoué.')
      },
    }),
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, networkMode: 'always' },
    },
  })
  const root = createRootRoute({
    component: Shell,
    notFoundComponent: NotFound,
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: Home,
  })
  const health = createRoute({
    getParentRoute: () => root,
    path: '/health',
    component: HealthView,
    loader: ({ context }) => {
      void context.queryClient.prefetchQuery(healthQuery)
    },
  })
  const authRoutes = [
    '/login',
    '/invitation',
    '/verification',
    '/identity',
    '/forgot-password',
    '/reset-password',
  ].map((path) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: AuthView,
      gcTime: 0,
      loader: async ({ context, abortController }) => {
        if (!['/invitation', '/reset-password'].includes(path)) return null
        let proof
        if (window.location.hash) {
          const fragment = new URLSearchParams(window.location.hash.slice(1))
          proof = {
            selector: fragment.get('selector') || '',
            verifier: fragment.get('verifier') || '',
          }
          window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname,
          )
        }
        try {
          const routeSessionQuery = {
            ...sessionQuery,
            queryFn: () =>
              context.api.auth('session', { signal: abortController.signal }),
          }
          let session
          try {
            session = await context.queryClient.fetchQuery(routeSessionQuery)
          } catch (error) {
            if (error.status !== 401) throw error
            context.queryClient.removeQueries({
              queryKey: sessionQuery.queryKey,
              exact: true,
            })
            session = await context.queryClient.fetchQuery(routeSessionQuery)
          }
          if (proof) {
            const endpoint =
              path === '/invitation'
                ? 'invitations/inspect'
                : 'password-reset/inspect'
            const invited = await context.api.auth(endpoint, {
              csrf: session.csrf,
              body: proof,
              signal: abortController.signal,
            })
            return { proof, email: invited.email }
          }
        } catch {
          /* The view offers a deliberate retry or an invalid-link message. */
        }
        return null
      },
    }),
  )
  const access = createRoute({
    getParentRoute: () => root,
    path: '/access/users',
    component: AccessView,
    gcTime: 0,
    validateSearch: (search) => ({
      email: String(search.email || '').slice(0, 254),
      role: [
        'ADMIN_PLATEFORME',
        'AGENT_SAISIE',
        'AGENT_VERIFICATEUR',
        'VALIDATEUR_DEFINITIF',
      ].includes(search.role)
        ? search.role
        : '',
      state: ['pending', 'active', 'inactive'].includes(search.state)
        ? search.state
        : '',
      invitationState: [
        'prepared',
        'delivered',
        'consumed',
        'revoked',
      ].includes(search.invitationState)
        ? search.invitationState
        : '',
      page:
        Number.isInteger(Number(search.page)) &&
        Number(search.page) > 0 &&
        Number(search.page) <= 1000000
          ? Number(search.page)
          : 1,
      invitationPage:
        Number.isInteger(Number(search.invitationPage)) &&
        Number(search.invitationPage) > 0 &&
        Number(search.invitationPage) <= 1000000
          ? Number(search.invitationPage)
          : 1,
    }),
    loader: async ({ context }) => {
      try {
        await context.queryClient.fetchQuery(sessionQuery)
      } catch {
        /* View distinguishes denied and unavailable. */
      }
    },
  })
  const planningRoutes = [
    ['/partners', 'partners'],
    ['/projects', 'projects'],
    ['/projects/$projectId/ptas/$year', 'pta'],
    ['/projects/$projectId/ptas/$year/activities/new', 'activityNew'],
    ['/activities/$activityId', 'activity'],
  ].map(([path, screen]) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: () => <PlanningView screen={screen} />,
      gcTime: 0,
      validateSearch: (search) => ({
        partnerCursor: String(search.partnerCursor || '').slice(0, 512),
        typeCursor: String(search.typeCursor || '').slice(0, 512),
        projectCursor: String(search.projectCursor || '').slice(0, 512),
        activityCursor: String(search.activityCursor || '').slice(0, 512),
        agentCursor: String(search.agentCursor || '').slice(0, 512),
        revisionCursor: String(search.revisionCursor || '').slice(0, 512),
        revision: String(search.revision || '').slice(0, 36),
        amendment: String(search.amendment || '').slice(0, 36),
      }),
      loader: async ({ context }) => {
        try {
          await context.queryClient.fetchQuery(sessionQuery)
        } catch {
          /* The protected view handles denial without exposing cached data. */
        }
      },
    }),
  )
  return createRouter({
    routeTree: root.addChildren([
      home,
      health,
      ...authRoutes,
      access,
      ...planningRoutes,
    ]),
    context: { queryClient, api },
    history,
  })
}

export function App({ router }) {
  return (
    <HelmetProvider>
      <RestClientProvider client={router.options.context.api}>
        <QueryClientProvider client={router.options.context.queryClient}>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors />
        </QueryClientProvider>
      </RestClientProvider>
    </HelmetProvider>
  )
}
