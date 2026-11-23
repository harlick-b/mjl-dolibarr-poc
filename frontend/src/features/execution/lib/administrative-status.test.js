import { describe, expect, test } from 'vitest'
import { executionAdministrativeStatus } from './administrative-status'

describe('executionAdministrativeStatus', () => {
  test('shows the décaissement step after physical work is complete', () => {
    expect(
      executionAdministrativeStatus({
        closure: null,
        works_completed: true,
        execution_paused: true,
        pause_reason: 'disbursement_frozen',
        closure_blockers: ['disbursement_not_settled'],
      }),
    ).toMatchObject({ code: 'disbursement' })
  })

  test.each([
    ['closed', 'success', { closure: { closed_at: '2026-11-23T10:00:00Z' } }],
    [
      'funding',
      'warning',
      {
        works_completed: true,
        pause_reason: 'funding_required',
        closure_blockers: ['financial_insufficiency_unresolved'],
      },
    ],
    [
      'administrative',
      'warning',
      {
        works_completed: false,
        execution_paused: true,
        pause_reason: 'amendment_pending',
        closure_blockers: ['planning_not_approved'],
      },
    ],
    [
      'realization',
      'info',
      {
        works_completed: false,
        execution_paused: false,
        closure_blockers: ['execution_incomplete'],
      },
    ],
    [
      'zeroSpending',
      'warning',
      {
        works_completed: true,
        spending_total: '0',
        execution_paused: true,
        pause_reason: 'zero_spending_frozen',
        closure_blockers: ['zero_spending_not_approved'],
      },
    ],
    [
      'virement',
      'warning',
      {
        works_completed: true,
        closure_blockers: ['virement_not_settled'],
      },
    ],
    [
      'virement',
      'warning',
      {
        works_completed: true,
        closure_blockers: ['virement_confirmation_required'],
      },
    ],
    [
      'reversement',
      'warning',
      {
        works_completed: true,
        closure_blockers: ['reversement_not_settled'],
      },
    ],
    ['ready', 'success', { works_completed: true, closure_blockers: [] }],
  ])('returns %s for the corresponding workflow step', (code, variant, row) => {
    expect(executionAdministrativeStatus(row)).toMatchObject({
      code,
      variant,
    })
  })

  test('keeps décaissement before virement when both remain unsettled', () => {
    expect(
      executionAdministrativeStatus({
        works_completed: true,
        closure_blockers: ['disbursement_not_settled', 'virement_not_settled'],
      }),
    ).toMatchObject({ code: 'disbursement' })
  })
})
