export function activityStatusClass(state) {
  if (['approved', 'closed'].includes(state))
    return 'bg-success-badge text-success'
  if (state?.startsWith('returned') || state === 'amendment_draft')
    return 'bg-warning-soft text-warning'
  if (state === 'withdrawn') return 'bg-danger-soft text-danger'
  if (state === 'draft') return 'bg-disabled text-muted-foreground'
  return 'bg-selected text-primary'
}
