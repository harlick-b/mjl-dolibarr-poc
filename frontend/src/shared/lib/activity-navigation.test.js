import { describe, expect, test } from 'vitest'
import {
  activityLocation,
  activityLocationForModule,
  activityRoute,
  activitySection,
  activitySource,
} from './activity-navigation'

test('uses a server-selected module without inventing an approval identifier', () => {
  expect(
    activityLocationForModule('activity-1', 'execution', 'finance'),
  ).toEqual({
    to: '/execution/activities/$activityId',
    params: { activityId: 'activity-1' },
    search: {},
    hash: 'finance',
  })
})

describe('activity navigation', () => {
  test('uses approval history to choose the canonical Activity module', () => {
    expect(
      activityLocation(
        {
          id: 'approved',
          state: 'amendment_draft',
          approved_revision_id: 'revision-1',
        },
        'finance',
      ),
    ).toEqual({
      to: '/execution/activities/$activityId',
      params: { activityId: 'approved' },
      search: {},
      hash: 'finance',
    })
    expect(activityLocation({ id: 'draft' }, 'programming')).toEqual({
      to: '/planning/activities/$activityId',
      params: { activityId: 'draft' },
      search: {},
      hash: '',
    })
    expect(activityRoute({ approved_revision_id: 'revision-1' })).toBe(
      '/execution/activities/$activityId',
    )
  })

  test('derives sidebar context from the route and normalizes unknown fragments', () => {
    expect(activitySource('/execution/activities/activity-1')).toBe('execution')
    expect(activitySource('/planning/activities/activity-1')).toBe('planning')
    for (const path of ['/dashboard', '/planning', '/execution', '/projects'])
      expect(activitySource(path)).toBeNull()
    expect(activitySection('')).toBe('programming')
    expect(activitySection('#unknown')).toBe('programming')
  })
})
