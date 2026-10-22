import { AuthView } from './AuthView'
import { authRequest, sessionQuery } from './auth'
import { useRouterState } from '@tanstack/react-router'
import { HealthView } from './HealthView'
import { healthQuery } from './health'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  if (['/login', '/invitation', '/verification', '/identity'].includes(path))
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
  ].map((path) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: AuthView,
      gcTime: 0,
      loader: async ({ context }) => {
        if (path !== '/invitation') return null
        let proof
        if (path === '/invitation' && window.location.hash) {
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
          const session = await context.queryClient.fetchQuery(sessionQuery)
          if (proof) {
            const invited = await authRequest('invitations/inspect', {
              csrf: session.csrf,
              body: proof,
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
  return createRouter({
    routeTree: root.addChildren([home, health, ...authRoutes]),
    context: { queryClient },
    history,
  })
}

export function App({ router }) {
  return (
    <QueryClientProvider client={router.options.context.queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
