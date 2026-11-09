import { WorkspaceOverview } from '@/features/dashboard/WorkspaceOverview'
import { ProfileView } from '@/features/auth/ProfileView'
import {
  LogoutProvider,
  LogoutScreen,
  useLogout,
} from '@/features/auth/LogoutProvider'
import { loginDestination, rememberPage } from '@/features/auth/navigation'
import { businessActionClassName } from '@/shared/ui/button-variants'
import { WorkspaceMain, WorkspaceFrame } from '@/shared/ui/layout'
import { strings } from '@/locales/fr/Router'
import { strings as common } from '@/locales/fr/common'
import { SessionProvider } from '@/features/auth/SessionProvider'
import {
  authorization,
  workspacePath,
  pageForPath,
} from '@/features/auth/authorization'
import { ApplicationSidebar } from '@/features/auth/ApplicationSidebar'
import { AccessDeniedState } from '@/features/auth/AccessDeniedState'
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
  ServiceUnavailableLogin,
} from '@/features/auth/AuthView'
import {
  AccessProvider,
  createAccessCoordinator,
  useAccess,
} from '@/features/auth/access-verification'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { redirect } from '@tanstack/react-router'
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
import { FallbackState } from '@/shared/ui/FallbackState'

function WorkspaceShell() {
  const access = useAccess()
  const identity = access.session
  const path = useLocation({ select: (location) => location.pathname })
  const page = pageForPath(path)
  const policy = authorization(identity)
  return (
    <WorkspaceFrame>
      <ApplicationSidebar user={identity?.user} />
      <div className="min-w-0">
        <WorkspaceMain>
          {page && !policy.canVisit(path) ? (
            <AccessDeniedState role={policy.role} />
          ) : (
            <Outlet />
          )}
        </WorkspaceMain>
      </div>
    </WorkspaceFrame>
  )
}

function ProtectedGate({ children }) {
  const access = useAccess()
  if (access.status === 'unknown' || access.status === 'checking')
    return <AccessVerificationState />
  if (access.status === 'anonymous') return <Navigate to="/login" replace />
  if (access.status === 'pending')
    return <Navigate to="/verification" replace />
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
          className={businessActionClassName}
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
  const logout = useLogout()
  const handledIdentityVersion = useRef(0)
  useEffect(() => {
    if (access.status === 'verified') rememberPage(access.session, path)
  }, [access.status, access.session, path])
  useEffect(() => {
    if (path !== '/health' && path !== '/logout' && access.status === 'unknown')
      void access.verify().catch(() => null)
  }, [access, path])
  useEffect(() => {
    if (
      access.status !== 'verified' ||
      access.identityVersion <= handledIdentityVersion.current
    )
      return
    handledIdentityVersion.current = access.identityVersion
    const destination = loginDestination(access.session)
    if (path !== destination) void navigate({ to: destination, replace: true })
  }, [access, navigate, path])
  if (access.reason === 'service-unavailable' && !logout.busy)
    return <ServiceUnavailableLogin />
  if (logout.busy || logout.error || access.reason === 'logout')
    return <LogoutScreen />
  const protectedPath =
    Boolean(pageForPath(path)) ||
    path === '/identity' ||
    path === '/access/users' ||
    path === '/dashboard' ||
    path === '/profile' ||
    path === '/planning' ||
    path === '/execution' ||
    path.startsWith('/partner') ||
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
      '/logout',
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
      '/logout',
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
    path === '/dashboard' ||
    path === '/profile' ||
    path === '/planning' ||
    path === '/execution' ||
    path.startsWith('/partner') ||
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
  return access.status === 'verified' ? (
    <WorkspaceShell />
  ) : (
    <AuthFrame title={strings.notFound}>
      <Outlet />
    </AuthFrame>
  )
}

function LogoutRoute() {
  const { logout } = useLogout()
  const access = useAccess()
  const started = useRef(false)
  useEffect(() => {
    if (access.status !== 'anonymous' && !started.current) {
      started.current = true
      void logout()
    }
  }, [logout, access.status])
  return access.status === 'anonymous' ? (
    <Navigate to="/login" replace />
  ) : (
    <LogoutScreen />
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
        <Link to={destination} className={businessActionClassName}>
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
      queries: {
        retry: false,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false, networkMode: 'always' },
    },
  })
  const root = createRootRoute({
    component: Shell,
    search: {
      middlewares: [
        ({ search, next }) =>
          Object.fromEntries(
            Object.entries(next(search)).filter(
              ([, value]) => value !== '' && value != null,
            ),
          ),
      ],
    },
    notFoundComponent: NotFound,
    errorComponent: RouteFailure,
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: componentOverrides.auth || AuthView,
    errorComponent: AuthRouteFailure,
  })
  const overviewRoutes = ['dashboard', 'planning', 'execution'].map((screen) =>
    createRoute({
      getParentRoute: () => root,
      path: `/${screen}`,
      validateSearch: (search) => ({
        ...(screen === 'execution'
          ? Object.fromEntries(
              ['q', 'state', 'agent'].map((key) => [
                key,
                String(search[key] || '').slice(0, key === 'q' ? 200 : 36),
              ]),
            )
          : {}),
        project: String(search.project || '').slice(0, 36),
        pta: String(search.pta || '').slice(0, 36),
        projectCursor: String(search.projectCursor || '').slice(0, 512),
        ptaCursor: String(search.ptaCursor || '').slice(0, 512),
        cursor: String(search.cursor || '').slice(0, 512),
        ...(Number.isInteger(Number(search.year)) &&
        Number(search.year) >= 2000 &&
        Number(search.year) <= 2200
          ? { year: Number(search.year) }
          : {}),
      }),
      component: () => <WorkspaceOverview screen={screen} />,
      errorComponent: RouteFailure,
    }),
  )
  const logoutRoute = createRoute({
    getParentRoute: () => root,
    path: '/logout',
    component: LogoutRoute,
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
      loader: ['/invitation', '/reset-password'].includes(path)
        ? async ({ context, abortController }) => {
            let proof
            if (window.location.hash) {
              const fragment = new URLSearchParams(
                window.location.hash.slice(1),
              )
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
          }
        : undefined,
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
      invite:
        search.invite === true || search.invite === 'true' ? true : undefined,
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
  const partnerExports = createRoute({
    getParentRoute: () => root,
    path: '/partner/exports',
    component: () => <PartnerPortalView screen="exports" />,
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
        q: String(search.q || '').slice(0, 200),
        state: String(search.state || '').slice(0, 32),
        agent: String(search.agent || '').slice(0, 36),
        from: String(search.from || '').slice(0, 10),
        to: String(search.to || '').slice(0, 10),
        view: search.view === 'calendar' ? 'calendar' : 'table',
        month:
          Number.isInteger(Number(search.month)) &&
          Number(search.month) >= 1 &&
          Number(search.month) <= 12
            ? Number(search.month)
            : undefined,
        tab: ['history', 'files'].includes(search.tab)
          ? search.tab
          : 'programming',
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
        ...(screen === 'list'
          ? Object.fromEntries(
              ['q', 'state', 'agent'].map((key) => [
                key,
                String(search[key] || '').slice(0, key === 'q' ? 200 : 36),
              ]),
            )
          : {}),
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
    search: {
      middlewares: [
        stripSearchParams({
          cursor: '',
          q: '',
          actor: '',
          activity: '',
          action: '',
          project: '',
          date_from: '',
          date_to: '',
        }),
      ],
    },
    gcTime: 0,
    validateSearch: (search) => ({
      cursor: String(search.cursor || '').slice(0, 512),
      ...Object.fromEntries(
        [
          'q',
          'actor',
          'activity',
          'action',
          'project',
          'date_from',
          'date_to',
        ].map((key) => [
          key,
          String(search[key] || '').slice(0, key === 'q' ? 200 : 48),
        ]),
      ),
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
      logoutRoute,
      health,
      createRoute({
        getParentRoute: () => root,
        path: '/profile',
        component: ProfileView,
        errorComponent: RouteFailure,
      }),
      createRoute({
        getParentRoute: () => root,
        path: '/identity',
        beforeLoad: () => {
          throw redirect({ to: '/profile', replace: true })
        },
      }),
      ...overviewRoutes,
      ...authRoutes,
      access,
      partnerPortal,
      partnerExports,
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
            <LogoutProvider>
              <SessionProvider>
                <RouterProvider router={router} />
                <Toaster position="top-right" richColors />
              </SessionProvider>
            </LogoutProvider>
          </AccessProvider>
        </QueryClientProvider>
      </RestClientProvider>
    </HelmetProvider>
  )
}
