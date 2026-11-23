export function buildActivityWorkflowRequest({
  action,
  item,
  reason,
  requestedAmount,
  plannedStart,
  plannedEnd,
  transferTasks = [],
}) {
  const baseRequest = {
    method: 'POST',
    body: { expected_version: item.version },
  }

  switch (action) {
    case 'submit':
      return {
        ...baseRequest,
        path: `/activities/${item.id}/submissions`,
      }
    case 'open_amendment':
      return lifecycleRequest(`/activities/${item.id}/amendments`, item, reason)
    case 'cancel_amendment':
      return lifecycleRequest(
        `/activities/${item.id}/amendments/${item.amendment.id}/cancellation`,
        item,
        reason,
      )
    case 'request_withdrawal':
      return lifecycleRequest(
        `/activities/${item.id}/withdrawals`,
        item,
        reason,
        {
          ...(item.withdrawal
            ? {
                withdrawal_id: item.withdrawal.id,
                expected_revision_id: item.current_revision_id,
              }
            : {}),
        },
      )
    case 'cancel_withdrawal':
      return lifecycleRequest(
        `/activities/${item.id}/withdrawals/${item.withdrawal.id}/cancellation`,
        item,
        reason,
        { expected_revision_id: item.current_revision_id },
      )
    case 'request_transfer':
      return lifecycleRequest(
        `/activities/${item.id}/transfers`,
        item,
        reason,
        {
          planned_start: plannedStart,
          planned_end: plannedEnd,
          tasks: transferTasks,
          ...(item.transfer
            ? {
                transfer_id: item.transfer.id,
                expected_revision_id: item.current_revision_id,
              }
            : {}),
        },
      )
    case 'cancel_transfer':
      return lifecycleRequest(
        `/activities/${item.id}/transfers/${item.transfer.id}/cancellation`,
        item,
        reason,
        { expected_revision_id: item.current_revision_id },
      )
    case 'prevalidate':
    case 'approve':
    case 'return':
      return {
        ...baseRequest,
        path: `/activities/${item.id}/revisions/${item.current_revision_id}/decisions`,
        body: {
          ...baseRequest.body,
          decision: action,
          ...(reason ? { reason } : {}),
          ...(action === 'return' && requestedAmount
            ? { requested_amount: requestedAmount }
            : {}),
        },
      }
    default:
      throw new Error(`Unsupported activity workflow action: ${action}`)
  }
}

function lifecycleRequest(path, item, reason, additionalBody = {}) {
  return {
    path,
    method: 'POST',
    body: {
      expected_version: item.version,
      expected_approved_revision_id: item.approved_revision_id,
      reason,
      ...additionalBody,
    },
  }
}
