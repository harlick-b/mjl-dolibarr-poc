// Page access only. Resource actions remain authoritative API allowed_actions.
const roles = {
  ADMIN_PLATEFORME: {
    label: 'Admin technique',
    home: '/access/users',
    pages: ['accounts', 'audit'],
  },
  AGENT_SAISIE: {
    label: 'Agent de saisie',
    home: '/projects',
    pages: ['business', 'notifications'],
  },
  AGENT_VERIFICATEUR: {
    label: 'Agent superviseur et prévalidateur',
    home: '/projects',
    pages: ['business', 'notifications'],
  },
  VALIDATEUR_DEFINITIF: {
    label: 'Validateur définitif',
    home: '/projects',
    pages: ['business', 'notifications', 'audit'],
  },
  PARTENAIRE: { label: 'Partenaire', home: '/partner', pages: ['partner'] },
}

export const roleLabels = Object.fromEntries(
  Object.entries(roles).map(([role, metadata]) => [role, metadata.label]),
)
export const isKnownRole = (role) => Object.hasOwn(roles, role)
export const workspacePath = (role) => roles[role]?.home ?? '/login'

export function authorization(session) {
  const user = session?.state === 'verified' ? session.user : null
  const policy = user && isKnownRole(user.role) ? roles[user.role] : null
  return {
    user: policy ? user : null,
    role: policy ? user.role : null,
    can: (page) => policy?.pages.includes(page) ?? false,
    workspace: policy?.home ?? '/login',
  }
}
