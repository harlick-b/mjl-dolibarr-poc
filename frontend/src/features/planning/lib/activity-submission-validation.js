import { strings } from '@/locales/fr/PlanningView'
import { formatXof } from '@/shared/lib/format'

export const positiveAmount = (value) => /^[1-9]\d*$/.test(String(value || ''))
export const percentagePattern =
  /^(?:100(?:\.0{1,2})?|(?:[1-9]?\d)(?:\.\d{1,2})?)$/
export const positivePercentage = (value) =>
  percentagePattern.test(String(value || '')) && Number(value) > 0
export const percentagePoints = (value) =>
  positivePercentage(value) ? Math.round(Number(value) * 100) : 0

export function sumAmounts(rows) {
  return rows.reduce(
    (sum, row) =>
      sum + (positiveAmount(row.allocation) ? BigInt(row.allocation) : 0n),
    0n,
  )
}

export function activitySubmissionProblems({
  name,
  start,
  end,
  amount,
  tasks,
}) {
  const problems = []
  if (!String(name || '').trim()) problems.push(strings.submissionActivityName)
  if (!start || !end || end < start)
    problems.push(strings.submissionActivityPeriod)
  if (!positiveAmount(amount)) problems.push(strings.submissionActivityAmount)
  if (!tasks.length) problems.push(strings.submissionTaskRequired)
  if (positiveAmount(amount) && sumAmounts(tasks) !== BigInt(amount))
    problems.push(
      strings.formatString(
        strings.submissionTaskAmountMismatch,
        formatXof(sumAmounts(tasks)),
        formatXof(amount),
      ),
    )
  if (
    tasks.reduce((sum, task) => sum + percentagePoints(task.weight), 0) !==
    10000
  )
    problems.push(strings.submissionTaskWeightTotal)
  tasks.forEach((task, taskIndex) => {
    const hasTaskName = Boolean(String(task.name || '').trim())
    const label = strings.formatString(
      strings.submissionTaskLabel,
      taskIndex + 1,
      hasTaskName ? task.name : strings.submissionUntitled,
    )
    if (!hasTaskName) problems.push(`${label} : ${strings.submissionTaskName}`)
    if (!positiveAmount(task.allocation))
      problems.push(`${label} : ${strings.submissionPositiveAmount}`)
    if (!task.type_id) problems.push(`${label} : ${strings.submissionCategory}`)
    if (!positivePercentage(task.weight))
      problems.push(`${label} : ${strings.submissionPositiveWeight}`)
    if (!task.planned_start || !task.planned_end)
      problems.push(`${label} : ${strings.submissionPlannedDates}`)
    else if (
      (start && task.planned_start < start) ||
      (end && task.planned_end > end) ||
      task.planned_end < task.planned_start
    )
      problems.push(`${label} : ${strings.submissionTaskDates}`)
    const children = task.subtasks || []
    if (!children.length) return
    if (
      positiveAmount(task.allocation) &&
      sumAmounts(children) !== BigInt(task.allocation)
    )
      problems.push(`${label} : ${strings.submissionSubtaskAmount}`)
    if (
      children.reduce(
        (sum, child) => sum + percentagePoints(child.weight),
        0,
      ) !== 10000
    )
      problems.push(`${label} : ${strings.submissionSubtaskWeightTotal}`)
    children.forEach((child, childIndex) => {
      const hasChildName = Boolean(String(child.name || '').trim())
      const childLabel = strings.formatString(
        strings.submissionSubtaskLabel,
        label,
        childIndex + 1,
        hasChildName ? child.name : strings.submissionUntitled,
      )
      if (!hasChildName)
        problems.push(`${childLabel} : ${strings.submissionSubtaskName}`)
      if (!positiveAmount(child.allocation))
        problems.push(`${childLabel} : ${strings.submissionPositiveAmount}`)
      if (!positivePercentage(child.weight))
        problems.push(`${childLabel} : ${strings.submissionPositiveWeight}`)
      if (!child.planned_start || !child.planned_end)
        problems.push(`${childLabel} : ${strings.submissionPlannedDates}`)
      else if (
        (task.planned_start && child.planned_start < task.planned_start) ||
        (task.planned_end && child.planned_end > task.planned_end) ||
        child.planned_end < child.planned_start
      )
        problems.push(`${childLabel} : ${strings.submissionSubtaskDates}`)
    })
  })
  return problems
}
