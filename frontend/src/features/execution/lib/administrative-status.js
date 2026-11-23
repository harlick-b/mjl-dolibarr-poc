export function executionAdministrativeStatus(row) {
  const blockers = row.closure_blockers || []
  if (row.closure) return { code: 'closed', variant: 'success' }
  if (
    row.pause_reason === 'funding_required' ||
    blockers.includes('financial_insufficiency_unresolved')
  )
    return { code: 'funding', variant: 'warning' }
  if (
    row.execution_paused &&
    !['disbursement_frozen', 'zero_spending_frozen'].includes(row.pause_reason)
  )
    return { code: 'administrative', variant: 'warning' }
  if (!row.works_completed || blockers.includes('execution_incomplete'))
    return { code: 'realization', variant: 'info' }
  if (blockers.includes('zero_spending_not_approved'))
    return { code: 'zeroSpending', variant: 'warning' }
  if (blockers.includes('disbursement_not_settled'))
    return { code: 'disbursement', variant: 'warning' }
  if (
    blockers.includes('virement_not_settled') ||
    blockers.includes('virement_confirmation_required')
  )
    return { code: 'virement', variant: 'warning' }
  if (blockers.includes('reversement_not_settled'))
    return { code: 'reversement', variant: 'warning' }
  if (blockers.length) return { code: 'administrative', variant: 'warning' }
  return { code: 'ready', variant: 'success' }
}
