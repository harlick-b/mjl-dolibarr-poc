import { strings } from '@/locales/fr/Router'
import { strings as common } from '@/locales/fr/common'
import {
  SessionProvider,
  useSessionQuery,
} from '@/features/auth/SessionProvider'
import { authorization, workspacePath } from '@/features/auth/authorization'
import { AdminSidebar } from '@/features/access/AdminSidebar'
import {
  AccessGate,
  AccessLoading,
  AccessView,
} from '@/features/access/AccessView'
import {
  AccessVerificationState,
  AuthFrame,
  AuthLoading,
  AuthView,
} from '@/features/auth/AuthView'
import {
  AccessProvider,
  createAccessCoordinator,
  useAccess,
} from '@/features/auth/access-verification'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { HealthView } from '@/features/health/HealthView'
import {
  ExecutionView,
  ExecutionLoading,
} from '@/features/execution/ExecutionView'
import { PlanningView, PlanningLoading } from '@/features/planning/PlanningView'
import {
  NotificationView,
  NotificationsLoading,
} from '@/features/notifications/NotificationView'
import {
  AuditHistoryView,
  HistoryLoading,
} from '@/features/audit/AuditHistoryView'
import {
  PartnerPortalView,
  PartnerLoading,
} from '@/features/partner-portal/PartnerPortalView'
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster, toast } from 'sonner'
import { RestClientProvider } from '@/shared/api/RestClientProvider'
import { api } from '@/shared/api/rest-client'
import {
  createRootRoute,
  createRoute,
  createRouter,
  stripSearchParams,
  Link,
  Navigate,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { Bell, FolderKanban, History, House } from 'lucide-react'
import { useAPI } from '@/shared/api/RestClientProvider'
import { FallbackState } from '@/shared/ui/FallbackState'

function WorkspaceShell() {
  const { api } = useAPI()
  const session = useSessionQuery()
  const userId = session.data?.user?.id
  const unread = useQuery({
    queryKey: ['notifications', userId, 'unread', '', 1],
    queryFn: ({ signal }) =>
      api.request('/api/v1/notifications?state=unread&limit=1', { signal }),
    enabled:
      session.data?.state === 'verified' &&
      session.data?.user?.role === 'AGENT_SAISIE',
    gcTime: 0,
  })
  if (authorization(session.data).can('accounts'))
    return (
      <div className="access-layout">
        <AdminSidebar user={session.data.user} />
        <main className="workspace-main">
          <Outlet />
        </main>
      </div>
    )
  if (authorization(session.data).can('partner'))
    return (
      <div className="workspace-shell">
        <aside className="workspace-sidebar partner-sidebar">
          <Link
            to="/partner"
            className="workspace-brand"
            aria-label="MJL — espace Partenaire"
          >
            <img src="/icon-192.png" alt="" width="36" height="36" /> MJL
          </Link>
          <p>Espace Partenaire · Lecture seule</p>
          <nav aria-label="Espace Partenaire">
            <Link to="/partner" activeProps={{ 'aria-current': 'page' }}>
              <House aria-hidden="true" size={19} /> Vue d’ensemble
            </Link>
            <Link to="/identity">
              <FolderKanban aria-hidden="true" size={19} /> Mon compte
            </Link>
          </nav>
        </aside>
        <main className="workspace-main">
          <Outlet />
        </main>
      </div>
    )
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link to="/" className="workspace-brand" aria-label="MJL — accueil">
          <img src="/icon-192.png" alt="" width="36" height="36" /> MJL
        </Link>
        <nav aria-label="Espace de travail">
          <Link to="/" activeProps={{ 'aria-current': 'page' }}>
            <House aria-hidden="true" size={19} /> Accueil
          </Link>
          <Link to="/projects" activeProps={{ 'aria-current': 'page' }}>
            <FolderKanban aria-hidden="true" size={19} /> Planification
          </Link>
          <Link to="/notifications" activeProps={{ 'aria-current': 'page' }}>
            <Bell aria-hidden="true" size={19} /> Notifications
            {unread.data?.count > 0 && (
              <span
                className="notification-badge"
                aria-label={`${unread.data.count} non lues`}
              >
                {unread.data.count}
              </span>
            )}
          </Link>
          {authorization(session.data).can('audit') && (
            <Link to="/history" activeProps={{ 'aria-current': 'page' }}>
              <History aria-hidden="true" size={19} /> Historique
            </Link>
          )}
        </nav>
      </aside>
      <main className="workspace-main">
        <Outlet />
      </main>
    </div>
  )
}

function ProtectedGate({ children, path }) {
  const access = useAccess()
  if (access.status === 'unknown' || access.status === 'checking')
    return <AccessVerificationState />
  if (access.status === 'anonymous') return <Navigate to="/login" replace />
  if (access.status === 'pending')
    return <Navigate to="/verification" replace />
  if (access.reason === 'logout') {
    if (path !== '/identity') return <Navigate to="/identity" replace />
    return <div data-access-protected="true">{children}</div>
  }
  if (access.status !== 'verified')
    return (
      <AccessVerificationState
        failed
        offline={access.reason === 'offline'}
        onRetry={() => void access.verify({ manual: true }).catch(() => null)}
      />
    )
  return <div data-access-protected="true">{children}</div>
}

function RouteFailure() {
  return (
    <FallbackState
      title={strings.unexpectedTitle}
      action={
        <button
          className="planning-button"
          onClick={() => window.location.reload()}
          type="button"
        >
          {strings.reload}
        </button>
      }
    >
      <p>{strings.unexpectedMessage}</p>
    </FallbackState>
  )
}

function AuthRouteFailure() {
  return (
    <AuthFrame title={strings.unexpectedTitle}>
      <RouteFailure />
    </AuthFrame>
  )
}

function AccessRouteFailure() {
  return (
    <AccessGate>
      <RouteFailure />
    </AccessGate>
  )
}

function Shell() {
  const path = useLocation({ select: (location) => location.pathname })
  const navigate = useNavigate()
  const access = useAccess()
  const handledIdentityVersion = useRef(0)
  useEffect(() => {
    if (path !== '/health' && access.status === 'unknown')
      void access.verify().catch(() => null)
  }, [access, path])
  useEffect(() => {
    if (
      access.status !== 'verified' ||
      access.identityVersion <= handledIdentityVersion.current
    )
      return
    handledIdentityVersion.current = access.identityVersion
    const destination = workspacePath(access.session.user.role)
    if (path !== destination) void navigate({ to: destination, replace: true })
  }, [access, navigate, path])
  const protectedPath =
    path === '/identity' ||
    path === '/access/users' ||
    path === '/partner' ||
    path === '/notifications' ||
    path === '/history' ||
    path === '/partners' ||
    path.startsWith('/projects') ||
    path.startsWith('/activities') ||
    path.startsWith('/execution')
  const knownPath =
    protectedPath ||
    [
      '/',
      '/health',
      '/login',
      '/invitation',
      '/verification',
      '/forgot-password',
      '/reset-password',
    ].includes(path)
  if (!knownPath && access.status === 'verified')
    return (
      <ProtectedGate path={path}>
        <WorkspaceShell />
      </ProtectedGate>
    )
  if (
    path === '/access/users' &&
    access.status === 'verified' &&
    access.session.user.role !== 'ADMIN_PLATEFORME'
  )
    return (
      <ProtectedGate path={path}>
        <WorkspaceShell />
      </ProtectedGate>
    )
  if (
    [
      '/',
      '/login',
      '/invitation',
      '/verification',
      '/identity',
      '/forgot-password',
      '/reset-password',
      '/access/users',
    ].includes(path)
  ) {
    const content = <Outlet />
    return protectedPath ? (
      <ProtectedGate path={path}>{content}</ProtectedGate>
    ) : (
      content
    )
  }
  if (
    path === '/partner' ||
    path === '/notifications' ||
    path === '/history' ||
    path === '/partners' ||
    path.startsWith('/projects') ||
    path.startsWith('/activities') ||
    path.startsWith('/execution')
  )
    return (
      <ProtectedGate path={path}>
        <WorkspaceShell />
      </ProtectedGate>
    )
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

function NotFound() {
  const access = useAccess()
  const destination =
    access.status === 'verified' ? workspacePath(access.session.user.role) : '/'
  return (
    <FallbackState
      title={strings.notFound}
      action={
        <Link to={destination} className="planning-button">
          {common.returnToWorkspace}
        </Link>
      }
    >
      <p>{strings.notFoundMessage}</p>
    </FallbackState>
  )
}

export function makeRouter(history, componentOverrides = {}) {
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
    errorComponent: RouteFailure,
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: componentOverrides.auth || AuthView,
    errorComponent: AuthRouteFailure,
  })
  const health = createRoute({
    getParentRoute: () => root,
    path: '/health',
    component: HealthView,
    errorComponent: RouteFailure,
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
      component: componentOverrides.auth || AuthView,
      errorComponent: AuthRouteFailure,
      pendingComponent: () => <AuthLoading path={path} />,
      pendingMs: 0,
      pendingMinMs: 0,
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
          const session = await context.access.verify()
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
    errorComponent: AccessRouteFailure,
    pendingComponent: AccessLoading,
    pendingMs: 0,
    pendingMinMs: 0,
    search: {
      middlewares: [
        stripSearchParams({
          email: '',
          role: '',
          state: '',
          invitationState: '',
          page: 1,
          invitationPage: 1,
        }),
      ],
    },
    gcTime: 0,
    validateSearch: (search) => ({
      email: String(search.email || '').slice(0, 254),
      role: [
        'ADMIN_PLATEFORME',
        'AGENT_SAISIE',
        'AGENT_VERIFICATEUR',
        'VALIDATEUR_DEFINITIF',
        'PARTENAIRE',
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
  })
  const partnerPortal = createRoute({
    getParentRoute: () => root,
    path: '/partner',
    component: PartnerPortalView,
    errorComponent: RouteFailure,
    pendingComponent: PartnerLoading,
    pendingMs: 0,
    pendingMinMs: 0,
    gcTime: 0,
    validateSearch: (search) => ({
      project: String(search.project || '').slice(0, 36),
      pta: String(search.pta || '').slice(0, 36),
      activity: String(search.activity || '').slice(0, 36),
      projectCursor: String(search.projectCursor || '').slice(0, 512),
      ptaCursor: String(search.ptaCursor || '').slice(0, 512),
      activityCursor: String(search.activityCursor || '').slice(0, 512),
      documentCursor: String(search.documentCursor || '').slice(0, 512),
    }),
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
      component: componentOverrides.planning
        ? componentOverrides.planning
        : () => <PlanningView screen={screen} />,
      errorComponent: RouteFailure,
      pendingComponent: () => <PlanningLoading screen={screen} />,
      pendingMs: 0,
      pendingMinMs: 0,
      gcTime: 0,
      validateSearch: (search) => ({
        partnerCursor: String(search.partnerCursor || '').slice(0, 512),
        typeCursor: String(search.typeCursor || '').slice(0, 512),
        projectCursor: String(search.projectCursor || '').slice(0, 512),
        activityCursor: String(search.activityCursor || '').slice(0, 512),
        agentCursor: String(search.agentCursor || '').slice(0, 512),
        revisionCursor: String(search.revisionCursor || '').slice(0, 512),
        documentCursor: String(search.documentCursor || '').slice(0, 512),
        revision: String(search.revision || '').slice(0, 36),
        amendment: String(search.amendment || '').slice(0, 36),
      }),
    }),
  )
  const executionRoutes = [
    ['/execution/$ptaId', 'list'],
    ['/execution/activities/$activityId', 'detail'],
  ].map(([path, screen]) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: () => <ExecutionView screen={screen} />,
      errorComponent: RouteFailure,
      pendingComponent: () => <ExecutionLoading screen={screen} />,
      pendingMs: 0,
      pendingMinMs: 0,
      gcTime: 0,
      validateSearch: (search) => ({
        cursor: String(search.cursor || '').slice(0, 512),
        historyCursor: String(search.historyCursor || '').slice(0, 512),
        financeCursor: String(search.financeCursor || '').slice(0, 512),
        fundingCursor: String(search.fundingCursor || '').slice(0, 512),
        zeroSpendingCursor: String(search.zeroSpendingCursor || '').slice(
          0,
          512,
        ),
        financeRequest: String(search.financeRequest || '').slice(0, 36),
        virementCursor: String(search.virementCursor || '').slice(0, 512),
        virementRequest: String(search.virementRequest || '').slice(0, 36),
      }),
    }),
  )
  const notifications = createRoute({
    getParentRoute: () => root,
    path: '/notifications',
    component: NotificationView,
    errorComponent: RouteFailure,
    pendingComponent: NotificationsLoading,
    pendingMs: 0,
    pendingMinMs: 0,
    gcTime: 0,
    validateSearch: (search) => ({
      cursor: String(search.cursor || '').slice(0, 512),
    }),
  })
  const historyRoute = createRoute({
    getParentRoute: () => root,
    path: '/history',
    component: AuditHistoryView,
    errorComponent: RouteFailure,
    pendingComponent: HistoryLoading,
    pendingMs: 0,
    pendingMinMs: 0,
    search: { middlewares: [stripSearchParams({ cursor: '' })] },
    gcTime: 0,
    validateSearch: (search) => ({
      cursor: String(search.cursor || '').slice(0, 512),
    }),
  })
  const accessCoordinator = createAccessCoordinator({
    queryClient,
    readSession: ({ signal }) => api.auth('session', { signal }),
  })
  api.configureAccess(accessCoordinator)
  return createRouter({
    routeTree: root.addChildren([
      home,
      health,
      ...authRoutes,
      access,
      partnerPortal,
      ...planningRoutes,
      ...executionRoutes,
      notifications,
      historyRoute,
    ]),
    context: { queryClient, api, access: accessCoordinator },
    history,
  })
}

export function App({ router }) {
  return (
    <HelmetProvider>
      <RestClientProvider client={router.options.context.api}>
        <QueryClientProvider client={router.options.context.queryClient}>
          <AccessProvider coordinator={router.options.context.access}>
            <SessionProvider>
              <RouterProvider router={router} />
              <Toaster position="top-right" richColors />
            </SessionProvider>
          </AccessProvider>
        </QueryClientProvider>
      </RestClientProvider>
    </HelmetProvider>
  )
}
