import { describe, expect, test } from 'vitest'
import { buildActivityWorkflowRequest } from './activity-workflow-request'

const item = {
  id: 'activity-1',
  version: 7,
  approved_revision_id: 'approved-1',
  current_revision_id: 'revision-2',
  amendment: { id: 'amendment-1' },
  withdrawal: { id: 'withdrawal-1' },
  transfer: { id: 'transfer-1' },
}

describe('activity workflow requests', () => {
  test('builds submission and reviewer decisions', () => {
    expect(buildActivityWorkflowRequest({ action: 'submit', item })).toEqual({
      path: '/activities/activity-1/submissions',
      method: 'POST',
      body: { expected_version: 7 },
    })
    expect(
      buildActivityWorkflowRequest({
        action: 'return',
        item,
        reason: 'À corriger',
        requestedAmount: '120000',
      }),
    ).toEqual({
      path: '/activities/activity-1/revisions/revision-2/decisions',
      method: 'POST',
      body: {
        expected_version: 7,
        decision: 'return',
        reason: 'À corriger',
        requested_amount: '120000',
      },
    })
  })

  test('builds amendment lifecycle requests', () => {
    expect(
      buildActivityWorkflowRequest({
        action: 'open_amendment',
        item,
        reason: 'Adapter',
      }),
    ).toEqual({
      path: '/activities/activity-1/amendments',
      method: 'POST',
      body: {
        expected_version: 7,
        expected_approved_revision_id: 'approved-1',
        reason: 'Adapter',
      },
    })
    expect(
      buildActivityWorkflowRequest({
        action: 'cancel_amendment',
        item,
        reason: 'Annuler',
      }),
    ).toMatchObject({
      path: '/activities/activity-1/amendments/amendment-1/cancellation',
      body: { expected_approved_revision_id: 'approved-1' },
    })
  })

  test('builds withdrawal lifecycle requests', () => {
    expect(
      buildActivityWorkflowRequest({
        action: 'request_withdrawal',
        item: { ...item, withdrawal: null },
        reason: 'Retirer',
      }),
    ).toEqual({
      path: '/activities/activity-1/withdrawals',
      method: 'POST',
      body: {
        expected_version: 7,
        expected_approved_revision_id: 'approved-1',
        reason: 'Retirer',
      },
    })
    expect(
      buildActivityWorkflowRequest({
        action: 'cancel_withdrawal',
        item,
        reason: 'Conserver',
      }).body,
    ).toEqual({
      expected_version: 7,
      expected_approved_revision_id: 'approved-1',
      expected_revision_id: 'revision-2',
      reason: 'Conserver',
    })
  })

  test('builds transfer lifecycle requests', () => {
    expect(
      buildActivityWorkflowRequest({
        action: 'request_transfer',
        item,
        reason: 'Reporter',
        plannedStart: '2028-01-01',
        plannedEnd: '2028-02-01',
        transferTasks: [{ id: 'task-1' }],
      }).body,
    ).toEqual({
      expected_version: 7,
      expected_approved_revision_id: 'approved-1',
      expected_revision_id: 'revision-2',
      transfer_id: 'transfer-1',
      reason: 'Reporter',
      planned_start: '2028-01-01',
      planned_end: '2028-02-01',
      tasks: [{ id: 'task-1' }],
    })
    expect(
      buildActivityWorkflowRequest({
        action: 'cancel_transfer',
        item,
        reason: 'Conserver',
      }).body,
    ).toEqual({
      expected_version: 7,
      expected_approved_revision_id: 'approved-1',
      expected_revision_id: 'revision-2',
      reason: 'Conserver',
    })
  })
})
