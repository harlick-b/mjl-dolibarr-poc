import { AuthUrls, Urls } from '@/app/urls'
import { WorkspaceOverview } from '@/features/dashboard/WorkspaceOverview'
import { ProfileView } from '@/features/auth/pages/ProfileView'
import {
  LogoutProvider,
  LogoutScreen,
  useLogout,
} from '@/features/auth/session/LogoutProvider'
import {
  loginDestination,
  rememberPage,
} from '@/features/auth/session/navigation'
import { Button } from '@/shared/ui/button'
import { WorkspaceMain, WorkspaceFrame } from '@/shared/ui/layout'
import { strings } from '@/locales/fr/Router'
import { strings as common } from '@/locales/fr/common'
import { SessionProvider } from '@/features/auth/session/SessionProvider'
import {
  authorization,
  workspacePath,
  pageForPath,
} from '@/features/auth/session/authorization'
import { ApplicationSidebar } from '@/features/auth/components/ApplicationSidebar'
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'
import {
  AccessGate,
  AccessLoading,
  AccessView,
} from '@/features/access/AccessView'
import {
  AuthView,
  ServiceUnavailableLogin,
} from '@/features/auth/pages/AuthView'
import { loadAuthProof } from '@/features/auth/route-loader'
import {
  AccessVerificationState,
  AuthFrame,
  AuthLoading,
} from '@/features/auth/components/AuthFrame'
import {
  AccessProvider,
  createAccessCoordinator,
  useAccess,
} from '@/features/auth/session/access-verification'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { redirect } from '@tanstack/react-router'
import { HealthView } from '@/features/health/HealthView'
import {
  ExecutionView,
  ExecutionLoading,
} from '@/features/execution/ExecutionView'
import {
  PlanningView,
  PlanningLoading,
} from '@/features/planning/pages/PlanningView'
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
  const path = useLocation({ select: (location) => location.pathname })
  if (access.status === 'unknown' || access.status === 'checking')
    return <AccessVerificationState />
  if (access.status === 'anonymous')
    return <Navigate to={Urls.login} state={{ returnTo: path }} replace />
  if (access.status === 'pending')
    return (
      <Navigate to={Urls.verification} state={{ returnTo: path }} replace />
    )
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
        <Button onClick={() => window.location.reload()} type="button">
          {strings.reload}
        </Button>
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
  const { identityVersion, reason, session, status, verify } = access
  useEffect(() => {
    if (status === 'verified') rememberPage(session, path)
  }, [path, session, status])
  useEffect(() => {
    if (path !== Urls.health && path !== Urls.logout && status === 'unknown')
      void verify().catch(() => null)
  }, [path, status, verify])
  useEffect(() => {
    if (
      status !== 'verified' ||
      identityVersion <= handledIdentityVersion.current
    )
      return
    handledIdentityVersion.current = identityVersion
    if (!pageForPath(path)) return
    const destination = loginDestination(session)
    if (path !== destination) void navigate({ to: destination, replace: true })
  }, [identityVersion, navigate, path, session, status])
  if (path === Urls.health) return <Outlet />
  if (reason === 'service-unavailable' && !logout.busy)
    return <ServiceUnavailableLogin />
  if (logout.busy || logout.error || reason === 'logout')
    return <LogoutScreen />
  const page = pageForPath(path)
  if (page) {
    const canManageAccounts =
      path === Urls.accessUsers &&
      status === 'verified' &&
      authorization(session).can('accounts')
    return (
      <ProtectedGate>
        {canManageAccounts ? <Outlet /> : <WorkspaceShell />}
      </ProtectedGate>
    )
  }
  if ([Urls.home, Urls.logout, ...AuthUrls].includes(path)) return <Outlet />
  if (status === 'unknown' || status === 'checking')
    return <AccessVerificationState />
  if (status === 'verified')
    return (
      <ProtectedGate>
        <WorkspaceShell />
      </ProtectedGate>
    )
  return (
    <AuthFrame title={strings.notFound} loading>
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
    <Navigate to={Urls.login} replace />
  ) : (
    <LogoutScreen />
  )
}

function NotFoundContent() {
  const access = useAccess()
  const destination =
    access.status === 'verified'
      ? workspacePath(access.session.user.role)
      : Urls.home
  return (
    <FallbackState
      title={strings.notFound}
      action={
        <Button asChild>
          <Link to={destination}>{common.returnToWorkspace}</Link>
        </Button>
      }
    >
      <p>{strings.notFoundMessage}</p>
    </FallbackState>
  )
}

const listSearchKeys = ['q', 'state', 'agent', 'from', 'to']

function activityListSearch(search) {
  return Object.fromEntries(
    listSearchKeys.map((key) => [
      key,
      String(search[key] || '').slice(
        0,
        key === 'q' ? 200 : ['from', 'to'].includes(key) ? 10 : 36,
      ),
    ]),
  )
}

export function makeRouter(history, componentOverrides = {}) {
  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.options.meta?.localError && error?.name !== 'AbortError')
          toast.error(
            mutation.options.meta?.errorMessage ||
              error?.message ||
              'L’action demandée n’a pas pu être enregistrée.',
          )
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
    notFoundComponent: NotFoundContent,
    errorComponent: RouteFailure,
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: Urls.home,
    component: componentOverrides.auth || AuthView,
    errorComponent: AuthRouteFailure,
  })
  const dashboard = createRoute({
    getParentRoute: () => root,
    path: Urls.dashboard,
    validateSearch: (search) => ({
      project: String(search.project || '').slice(0, 36),
      pta: String(search.pta || '').slice(0, 36),
    }),
    component: () => <WorkspaceOverview screen="dashboard" />,
    errorComponent: RouteFailure,
  })
  const planningOverview = createRoute({
    getParentRoute: () => root,
    path: Urls.planning,
    validateSearch: (search) => ({
      project: String(search.project || '').slice(0, 36),
    }),
    component: () => <WorkspaceOverview screen="planning" />,
    errorComponent: RouteFailure,
  })
  const executionOverview = createRoute({
    getParentRoute: () => root,
    path: Urls.execution,
    validateSearch: (search) => ({
      ...activityListSearch(search),
      project: String(search.project || '').slice(0, 36),
      pta: String(search.pta || '').slice(0, 36),
    }),
    component: () => <WorkspaceOverview screen="execution" />,
    errorComponent: RouteFailure,
  })
  const logoutRoute = createRoute({
    getParentRoute: () => root,
    path: Urls.logout,
    component: LogoutRoute,
  })
  const health = createRoute({
    getParentRoute: () => root,
    path: Urls.health,
    component: HealthView,
    errorComponent: RouteFailure,
  })
  const authRoutes = AuthUrls.map((path) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: componentOverrides.auth || AuthView,
      errorComponent: AuthRouteFailure,
      pendingComponent: () => <AuthLoading path={path} />,
      pendingMs: 0,
      pendingMinMs: 0,
      gcTime: 0,
      loader: [Urls.invitation, Urls.resetPassword].includes(path)
        ? (loaderContext) => loadAuthProof(path, loaderContext)
        : undefined,
    }),
  )
  const access = createRoute({
    getParentRoute: () => root,
    path: Urls.accessUsers,
    component: AccessView,
    errorComponent: AccessRouteFailure,
    pendingComponent: AccessLoading,
    pendingMs: 0,
    pendingMinMs: 0,
    search: {
      middlewares: [
        stripSearchParams({
          q: '',
          role: '',
        }),
      ],
    },
    gcTime: 0,
    validateSearch: (search) => ({
      q: String(search.q || '').slice(0, 200),
      role: [
        'ADMIN_PLATEFORME',
        'AGENT_SAISIE',
        'AGENT_VERIFICATEUR',
        'VALIDATEUR_DEFINITIF',
        'PARTENAIRE',
      ].includes(search.role)
        ? search.role
        : '',
    }),
  })
  const partnerPortal = createRoute({
    getParentRoute: () => root,
    path: Urls.partner,
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
    }),
  })
  const partnerExports = createRoute({
    getParentRoute: () => root,
    path: Urls.partnerExports,
    component: () => <PartnerPortalView screen="exports" />,
    errorComponent: RouteFailure,
    pendingComponent: PartnerLoading,
    pendingMs: 0,
    pendingMinMs: 0,
    gcTime: 0,
    validateSearch: (search) => ({
      project: String(search.project || '').slice(0, 36),
      pta: String(search.pta || '').slice(0, 36),
    }),
  })
  const planningRoutes = [
    [Urls.partners, 'partners'],
    [Urls.projects, 'projects'],
    [Urls.pta, 'pta'],
    [Urls.newActivity, 'activityNew'],
    [Urls.planningActivity, 'activity'],
    [Urls.executionActivity, 'activity'],
  ].map(([path, screen]) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component:
        path === Urls.executionActivity && componentOverrides.execution
          ? () => componentOverrides.execution('detail')
          : componentOverrides.planning
            ? componentOverrides.planning
            : () => <PlanningView screen={screen} />,
      errorComponent: RouteFailure,
      pendingComponent: () => <PlanningLoading screen={screen} />,
      pendingMs: 0,
      pendingMinMs: 0,
      gcTime: 0,
      search:
        screen === 'pta'
          ? undefined
          : { middlewares: [stripSearchParams(true)] },
      validateSearch: (search) =>
        screen === 'pta'
          ? {
              q: String(search.q || '').slice(0, 200),
              state: String(search.state || '').slice(0, 32),
              review: search.review === 'mine' ? 'mine' : '',
              agent: String(search.agent || '').slice(0, 36),
              from: String(search.from || '').slice(0, 10),
              to: String(search.to || '').slice(0, 10),
              view: search.view === 'calendar' ? 'calendar' : '',
              month:
                search.view === 'calendar' &&
                Number.isInteger(Number(search.month)) &&
                Number(search.month) >= 1 &&
                Number(search.month) <= 12
                  ? Number(search.month)
                  : undefined,
            }
          : {},
    }),
  )
  const executionPta = createRoute({
    getParentRoute: () => root,
    path: Urls.executionPta,
    component: componentOverrides.execution
      ? () => componentOverrides.execution('list')
      : () => <ExecutionView screen="list" />,
    errorComponent: RouteFailure,
    pendingComponent: () => <ExecutionLoading screen="list" />,
    pendingMs: 0,
    pendingMinMs: 0,
    gcTime: 0,
    validateSearch: activityListSearch,
  })
  const historyRoute = createRoute({
    getParentRoute: () => root,
    path: Urls.history,
    component: AuditHistoryView,
    errorComponent: RouteFailure,
    pendingComponent: HistoryLoading,
    pendingMs: 0,
    pendingMinMs: 0,
    search: {
      middlewares: [
        stripSearchParams({
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
  const profile = createRoute({
    getParentRoute: () => root,
    path: Urls.profile,
    component: ProfileView,
    errorComponent: RouteFailure,
  })
  const identity = createRoute({
    getParentRoute: () => root,
    path: Urls.identity,
    beforeLoad: () => {
      throw redirect({ to: Urls.profile, replace: true })
    },
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
      ...authRoutes,
      access,
      dashboard,
      planningOverview,
      executionOverview,
      profile,
      identity,
      partnerPortal,
      partnerExports,
      ...planningRoutes,
      executionPta,
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
                <Toaster
                  position="bottom-center"
                  toastOptions={{
                    classNames: {
                      toast:
                        '!rounded-card !border-navy !bg-navy !text-white !shadow-lg',
                      description: '!text-white/80',
                      success: '!border-navy !bg-navy !text-white',
                      error: '!border-danger !bg-danger !text-white',
                      warning: '!border-warning !bg-warning !text-white',
                      info: '!border-primary !bg-primary !text-white',
                    },
                  }}
                />
              </SessionProvider>
            </LogoutProvider>
          </AccessProvider>
        </QueryClientProvider>
      </RestClientProvider>
    </HelmetProvider>
  )
}
