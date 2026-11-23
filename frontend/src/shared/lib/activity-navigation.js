import { Urls } from '@/app/urls'

export const activitySections = new Set([
  'realization',
  'finance',
  'history',
  'files',
])

export function activitySection(hash) {
  const value = String(hash || '').replace(/^#/, '')
  return activitySections.has(value) ? value : 'programming'
}

export function activitySource(pathname) {
  return String(pathname || '').startsWith('/execution/activities/')
    ? 'execution'
    : 'planning'
}

export function activityRoute(activity) {
  return activity?.approved_revision_id
    ? Urls.executionActivity
    : Urls.planningActivity
}

export function activityLocation(activity, section = 'programming') {
  return {
    to: activityRoute(activity),
    params: { activityId: activity.id },
    search: {},
    hash: section === 'programming' ? '' : section,
  }
}

export function activityLocationForModule(
  activityId,
  module,
  section = 'programming',
) {
  return {
    to: module === 'execution' ? Urls.executionActivity : Urls.planningActivity,
    params: { activityId },
    search: {},
    hash: section === 'programming' ? '' : section,
  }
}
