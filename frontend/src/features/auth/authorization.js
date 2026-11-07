import { strings } from '@/locales/fr/Navigation'

// Page visibility only. Server role/resource/state guards remain authoritative.
const roles = {
  ADMIN_PLATEFORME: {
    label: 'Admin technique',
    home: '/dashboard',
    capabilities: ['accounts', 'audit'],
  },
  AGENT_SAISIE: {
    label: 'Agent de saisie',
    home: '/dashboard',
    capabilities: ['business', 'notifications'],
  },
  AGENT_VERIFICATEUR: {
    label: 'Agent superviseur et prévalidateur',
    home: '/dashboard',
    capabilities: ['business', 'notifications', 'ptaManagement'],
  },
  VALIDATEUR_DEFINITIF: {
    label: 'Validateur définitif',
    home: '/dashboard',
    capabilities: [
      'business',
      'notifications',
      'audit',
      'catalog',
      'ptaManagement',
    ],
  },
  PARTENAIRE: {
    label: 'Partenaire',
    home: '/dashboard',
    capabilities: ['partner'],
  },
}
// Navigation, direct-route checks and remembered destinations consume this catalog.
// Detail pages inherit their owning page; they are never separate sidebar entries.
const pages = [
  {
    id: 'dashboard',
    path: '/dashboard',
    capability: 'identity',
    icon: 'dashboard',
    matches: /^\/dashboard$/,
  },
  {
    id: 'planning',
    path: '/planning',
    capability: 'business',
    icon: 'planning',
    matches:
      /^(?:\/planning|\/projects\/[\w-]+\/ptas\/\d{4}(?:\/activities\/new)?|\/activities\/[\w-]+)$/,
  },
  {
    id: 'execution',
    path: '/execution',
    capability: 'business',
    icon: 'execution',
    matches: /^\/execution(?:\/(?:activities\/)?[\w-]+)?$/,
  },
  {
    id: 'partners',
    path: '/partners',
    capability: 'catalog',
    icon: 'partners',
    matches: /^\/partners$/,
  },
  {
    id: 'projects',
    path: '/projects',
    capability: 'catalog',
    icon: 'projects',
    matches: /^\/projects$/,
  },
  {
    id: 'accounts',
    path: '/access/users',
    capability: 'accounts',
    icon: 'accounts',
    matches: /^\/access\/users$/,
  },
  {
    id: 'partner',
    path: '/partner',
    capability: 'partner',
    icon: 'planning',
    matches: /^\/partner$/,
  },
  {
    id: 'exports',
    path: '/partner/exports',
    capability: 'partner',
    icon: 'exports',
    matches: /^\/partner\/exports$/,
  },
  {
    id: 'audit',
    path: '/history',
    capability: 'audit',
    icon: 'audit',
    matches: /^\/history$/,
  },
  {
    id: 'notifications',
    hidden: true,
    path: '/notifications',
    capability: 'notifications',
    icon: 'notifications',
    matches: /^\/notifications$/,
  },
  {
    id: 'identity',
    path: '/profile',
    capability: 'identity',
    icon: 'identity',
    hidden: true,
    matches: /^\/(?:profile|identity)$/,
  },
]
export const roleLabels = Object.fromEntries(
  Object.entries(roles).map(([role, value]) => [role, value.label]),
)
export const isKnownRole = (role) => Object.hasOwn(roles, role)
export const workspacePath = (role) => roles[role]?.home ?? '/login'
export const pageForPath = (path) => {
  const page = pages.find((item) => item.matches.test(path))
  return page ? { ...page, label: strings[page.id] } : null
}
export function authorization(session) {
  const user = session?.state === 'verified' ? session.user : null
  const policy = user && isKnownRole(user.role) ? roles[user.role] : null
  const can = (capability) =>
    Boolean(
      policy &&
      (capability === 'identity' || policy.capabilities.includes(capability)),
    )
  return {
    user: policy ? user : null,
    role: policy ? user.role : null,
    can,
    workspace: policy?.home ?? '/login',
    canVisit: (path) => {
      const page = pageForPath(path)
      return Boolean(page && can(page.capability))
    },
    navigation: pages
      .filter((page) => !page.hidden && can(page.capability))
      .map((page) => ({ ...page, label: strings[page.id] })),
  }
}
