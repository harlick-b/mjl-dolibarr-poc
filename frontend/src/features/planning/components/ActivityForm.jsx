import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Urls } from '@/app/urls'
import { toast } from 'sonner'
import { DatePicker } from '@/shared/ui/DatePicker'
import { ExactNumberInput } from '@/shared/ui/ExactNumberInput'
import { Select } from '@/shared/ui/select'
import { Button } from '@/shared/ui/button'
import { Panel } from '@/shared/ui/layout'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Modal } from '@/shared/ui/BusinessModal'
import { Pagination } from '@/shared/ui/Pagination'
import { FileSelection } from '@/shared/ui/FileSelection'
import {
  formatExactNumber,
  formatXof,
  localDateInput,
  addThreeMonths,
} from '@/shared/lib/format'
import { strings } from '@/locales/fr/PlanningView'
import { CategoryCreator } from './CategoryCreator'
import { cursorFrom } from '@/shared/lib/pagination'
import { CompactAllocationTable } from './CompactAllocationTable'
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs'
import { missingRequiredFieldProps } from '@/shared/ui/required-field-feedback'
import { RequiredFieldError } from '@/shared/ui/RequiredFieldError'
import {
  activitySubmissionProblems,
  percentagePattern,
  percentagePoints,
  positiveAmount,
  positivePercentage,
  sumAmounts,
} from '../lib/activity-submission-validation'

function subtaskCountLabel(count) {
  return strings.formatString(
    count > 1 ? strings.subtaskCountPlural : strings.subtaskCount,
    count,
  )
}

function emptyTask() {
  return {
    _key: crypto.randomUUID(),
    type_id: '',
    name: '',
    description: '',
    allocation: '',
    weight: '',
    planned_start: '',
    planned_end: '',
    subtasks: [],
  }
}

function emptySubtask() {
  return {
    _key: crypto.randomUUID(),
    name: '',
    description: '',
    allocation: '',
    weight: '',
    planned_start: '',
    planned_end: '',
  }
}

function persistedTasks(tasks) {
  return tasks.map((task) => ({
    id: task.id || undefined,
    type_id: task.type_id || null,
    name: task.name.trim(),
    description: task.description || '',
    allocation: task.allocation,
    weight: task.weight || null,
    planned_start: task.planned_start || null,
    planned_end: task.planned_end || null,
    subtasks: (task.subtasks || []).map((child) => ({
      id: child.id || undefined,
      name: child.name.trim(),
      description: child.description || '',
      allocation: child.allocation,
      weight: child.weight || null,
      planned_start: child.planned_start || null,
      planned_end: child.planned_end || null,
    })),
  }))
}

function draftProblems({ name, start, end, amount, tasks }) {
  const problems = []
  if (!name.trim()) problems.push(strings.submissionActivityName)
  if (start && end && end < start) problems.push(strings.draftActivityPeriod)
  if (positiveAmount(amount) && sumAmounts(tasks) > BigInt(amount))
    problems.push(strings.draftTaskAmountExceeded)
  if (
    tasks.reduce((sum, task) => sum + percentagePoints(task.weight), 0) > 10000
  )
    problems.push(strings.draftTaskWeightExceeded)
  tasks.forEach((task, taskIndex) => {
    const label = strings.formatString(
      strings.submissionTaskLabel,
      taskIndex + 1,
      task.name || strings.submissionUntitled,
    )
    const children = task.subtasks || []
    if (
      String(task.weight || '') &&
      !percentagePattern.test(String(task.weight))
    )
      problems.push(`${label} : ${strings.draftTaskWeightInvalid}`)
    if (
      (start && task.planned_start && task.planned_start < start) ||
      (end && task.planned_end && task.planned_end > end) ||
      (task.planned_start &&
        task.planned_end &&
        task.planned_end < task.planned_start)
    )
      problems.push(`${label} : ${strings.submissionTaskDates}`)
    if (
      positiveAmount(task.allocation) &&
      sumAmounts(children) > BigInt(task.allocation)
    )
      problems.push(`${label} : ${strings.draftSubtaskAmountExceeded}`)
    if (
      children.reduce((sum, child) => sum + percentagePoints(child.weight), 0) >
      10000
    )
      problems.push(`${label} : ${strings.draftSubtaskWeightExceeded}`)
    children.forEach((child, childIndex) => {
      const childLabel = strings.formatString(
        strings.submissionSubtaskLabel,
        label,
        childIndex + 1,
        child.name || strings.submissionUntitled,
      )
      if (
        String(child.weight || '') &&
        !percentagePattern.test(String(child.weight))
      )
        problems.push(`${childLabel} : ${strings.draftSubtaskWeightInvalid}`)
      if (
        (task.planned_start &&
          child.planned_start &&
          child.planned_start < task.planned_start) ||
        (task.planned_end &&
          child.planned_end &&
          child.planned_end > task.planned_end) ||
        (child.planned_start &&
          child.planned_end &&
          child.planned_end < child.planned_start)
      )
        problems.push(`${childLabel} : ${strings.submissionSubtaskDates}`)
    })
  })
  return problems
}

function ConfirmRemoval({ removal, onClose, onConfirm }) {
  if (!removal) return null
  return createPortal(
    <Modal open onClose={onClose} label={removal.label} opener={removal.opener}>
      <div className="grid gap-5 px-6 pb-6 pt-5">
        <p>{removal.message}</p>
        <div data-ui="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {strings.cancel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {strings.remove}
          </Button>
        </div>
      </div>
    </Modal>,
    document.body,
  )
}

function SubtaskDrawer({ task, index, submissionAttempted, onClose, onSave }) {
  const opener = useRef(document.activeElement)
  const [draft, setDraft] = useState(() =>
    index === null ? emptySubtask() : { ...task.subtasks[index] },
  )
  const [attemptedSave, setAttemptedSave] = useState(false)
  const update = (changes) =>
    setDraft((current) => ({ ...current, ...changes }))
  const valid = draft.name.trim() && positiveAmount(draft.allocation)
  const missingName = attemptedSave && !draft.name.trim()
  const missingAmount = attemptedSave && !positiveAmount(draft.allocation)
  const missingWeight = submissionAttempted && !positivePercentage(draft.weight)
  const missingStart = submissionAttempted && !draft.planned_start
  const missingEnd = submissionAttempted && !draft.planned_end
  return createPortal(
    <Modal
      open
      onClose={onClose}
      opener={opener}
      variant="drawer"
      label={
        index === null ? strings.addSubtaskTitle : strings.editSubtaskTitle
      }
      subtitle={task.name}
    >
      <Panel
        as={BusinessForm}
        className="min-h-0 grid-rows-[minmax(0,1fr)_auto] rounded-none border-0"
        onSubmit={(event) => {
          event.stopPropagation()
          setAttemptedSave(true)
          if (!valid) return false
          return onSave(draft)
        }}
      >
        <div className="grid content-start gap-5 overflow-y-auto">
          <label>
            {strings.title} *
            <input
              aria-label={strings.title}
              aria-required="true"
              {...missingRequiredFieldProps(missingName, 'subtask-name-error')}
              autoFocus
              maxLength={200}
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
            />
            <RequiredFieldError id="subtask-name-error" show={missingName} />
          </label>
          <label>
            {strings.description}
            <textarea
              rows={3}
              maxLength={4000}
              value={draft.description || ''}
              onChange={(event) => update({ description: event.target.value })}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              {strings.operationAmount} *
              <ExactNumberInput
                aria-label={strings.subtaskPlannedAmount}
                aria-required="true"
                {...missingRequiredFieldProps(
                  missingAmount,
                  'subtask-amount-error',
                )}
                value={draft.allocation}
                onChange={(allocation) => update({ allocation })}
              />
              <RequiredFieldError
                id="subtask-amount-error"
                show={missingAmount}
              />
            </label>
            <label>
              {strings.subtaskWeightPercent} *
              <ExactNumberInput
                scale={2}
                min="0"
                max="100"
                step="0.01"
                aria-label={strings.subtaskWeightPercent}
                aria-required="true"
                {...missingRequiredFieldProps(
                  missingWeight,
                  'subtask-weight-error',
                )}
                value={draft.weight || ''}
                onChange={(weight) => update({ weight })}
              />
              <RequiredFieldError
                id="subtask-weight-error"
                show={missingWeight}
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              {strings.subtaskStartDate} *
              <DatePicker
                label={strings.subtaskStartDate}
                aria-required="true"
                {...missingRequiredFieldProps(
                  missingStart,
                  'subtask-start-error',
                )}
                value={draft.planned_start || ''}
                min={task.planned_start || undefined}
                max={draft.planned_end || task.planned_end || undefined}
                optional
                onChange={(planned_start) => update({ planned_start })}
              />
              <RequiredFieldError
                id="subtask-start-error"
                show={missingStart}
              />
            </label>
            <label>
              {strings.subtaskEndDate} *
              <DatePicker
                label={strings.subtaskEndDate}
                aria-required="true"
                {...missingRequiredFieldProps(missingEnd, 'subtask-end-error')}
                value={draft.planned_end || ''}
                min={draft.planned_start || task.planned_start || undefined}
                max={task.planned_end || undefined}
                optional
                onChange={(planned_end) => update({ planned_end })}
              />
              <RequiredFieldError id="subtask-end-error" show={missingEnd} />
            </label>
          </div>
        </div>
        <div data-ui="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {strings.cancel}
          </Button>
          <Button type="submit">{strings.saveSubtask}</Button>
        </div>
      </Panel>
    </Modal>,
    document.body,
  )
}

function CategoryPager({ result, navigate }) {
  const move = (link) =>
    navigate({
      search: (current) => ({
        ...current,
        typeCursor: cursorFrom(link, '/task-categories'),
      }),
    })
  return (
    <Pagination
      label={strings.categoryPages}
      canPrevious={Boolean(result?.previous)}
      canNext={Boolean(result?.next)}
      onPrevious={() => move(result.previous)}
      onNext={() => move(result.next)}
      previousLabel={strings.previousPage}
      nextLabel={strings.nextPage}
      size="sm"
    />
  )
}

function TaskEditor({
  task,
  activity,
  types,
  pending,
  categoriesUnavailable,
  typeResult,
  navigate,
  onReturnToActivity,
  onCreateType,
  onCancel,
  onSave,
  submissionAttempted,
}) {
  const [draft, setDraft] = useState(() => ({
    ...task,
    subtasks: [...(task.subtasks || [])],
  }))
  const [drawerIndex, setDrawerIndex] = useState(undefined)
  const [removal, setRemoval] = useState(null)
  const [categoryCreatorOpen, setCategoryCreatorOpen] = useState(false)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const categorySelect = useRef(null)
  const update = (changes) =>
    setDraft((current) => ({ ...current, ...changes }))
  const amountTotal = sumAmounts(draft.subtasks)
  const weightTotal = draft.subtasks.reduce(
    (sum, child) => sum + percentagePoints(child.weight),
    0,
  )
  const availableTypes = [...types]
  if (
    draft.type_id &&
    !availableTypes.some((type) => type.id === draft.type_id)
  )
    availableTypes.push({
      id: draft.type_id,
      label: draft.type_label || strings.existingCategory,
    })
  const canSave = draft.name.trim() && positiveAmount(draft.allocation)
  const missingName = attemptedSave && !draft.name.trim()
  const missingCategory = submissionAttempted && !draft.type_id
  const missingStart = submissionAttempted && !draft.planned_start
  const missingEnd = submissionAttempted && !draft.planned_end
  const missingAmount = attemptedSave && !positiveAmount(draft.allocation)
  const missingWeight = submissionAttempted && !positivePercentage(draft.weight)
  return (
    <Panel
      as={BusinessForm}
      className="activity-task-editor mx-auto w-full max-w-[960px] gap-6 border-0 bg-transparent p-0"
      data-task-editor
      onSubmit={(event) => {
        event.stopPropagation()
        setAttemptedSave(true)
        if (!canSave || pending) return false
        return onSave(draft)
      }}
    >
      <Breadcrumbs
        label={strings.breadcrumb}
        items={[
          { label: strings.planningIndex, to: Urls.planning },
          activity.projectId
            ? {
                label: `PTA ${activity.year}`,
                to: Urls.pta,
                params: {
                  projectId: activity.projectId,
                  year: String(activity.year),
                },
              }
            : { label: `PTA ${activity.year}` },
          {
            label: strings.activitySingular,
            to: activity.id ? Urls.activity : Urls.newActivity,
            params: activity.id
              ? { activityId: activity.id }
              : {
                  projectId: activity.projectId,
                  year: String(activity.year),
                },
            onClick: (event) => {
              event.preventDefault()
              onReturnToActivity()
            },
          },
          { label: task.id || task.name ? strings.editTask : strings.newTask },
        ]}
      />
      <header>
        <h1 className="text-2xl font-semibold text-navy">
          {task.id || task.name
            ? draft.name || strings.untitledTask
            : strings.addOperation}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {activity.name} · PTA {activity.year}
        </p>
      </header>
      <Panel className="gap-0 overflow-hidden p-0">
        <h2 className="border-b border-border px-6 py-5">
          {strings.generalInformation}
        </h2>
        <div className="grid gap-5 p-6">
          <label>
            {strings.title} *
            <input
              aria-label={strings.title}
              aria-required="true"
              {...missingRequiredFieldProps(missingName, 'task-name-error')}
              autoFocus
              maxLength={200}
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
            />
            <RequiredFieldError id="task-name-error" show={missingName} />
          </label>
          <label>
            {strings.description}
            <textarea
              rows={3}
              maxLength={4000}
              value={draft.description || ''}
              onChange={(event) => update({ description: event.target.value })}
            />
          </label>
          <div className="grid max-w-[360px] gap-2">
            <label>
              {strings.activityOperationType} *
              <Select
                aria-label={strings.activityOperationType}
                aria-required="true"
                {...missingRequiredFieldProps(
                  missingCategory,
                  'task-category-error',
                )}
                ref={categorySelect}
                value={draft.type_id || ''}
                disabled={categoriesUnavailable}
                onChange={(event) => {
                  if (event.target.value === '__create__') {
                    setCategoryCreatorOpen(true)
                    return
                  }
                  update({ type_id: event.target.value })
                }}
              >
                <option value="">{strings.choose}</option>
                {availableTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
                {onCreateType && (
                  <option value="__create__" data-cta>
                    {strings.createCategory}
                  </option>
                )}
              </Select>
              <RequiredFieldError
                id="task-category-error"
                show={missingCategory}
              />
            </label>
            {onCreateType && categoryCreatorOpen && (
              <CategoryCreator
                onCreate={onCreateType}
                disabled={pending || categoriesUnavailable}
                open={categoryCreatorOpen}
                onOpenChange={setCategoryCreatorOpen}
                hideTrigger
                openerRef={categorySelect}
                onCreated={(type) =>
                  update({ type_id: type.id, type_label: type.label })
                }
              />
            )}
            {navigate && (
              <CategoryPager result={typeResult} navigate={navigate} />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              {strings.plannedStart} *
              <DatePicker
                label={strings.plannedStart}
                aria-required="true"
                {...missingRequiredFieldProps(missingStart, 'task-start-error')}
                value={draft.planned_start || ''}
                min={activity.start || undefined}
                max={draft.planned_end || activity.end || undefined}
                optional
                onChange={(planned_start) => update({ planned_start })}
              />
              <RequiredFieldError id="task-start-error" show={missingStart} />
            </label>
            <label>
              {strings.plannedEnd} *
              <DatePicker
                label={strings.plannedEnd}
                aria-required="true"
                {...missingRequiredFieldProps(missingEnd, 'task-end-error')}
                value={draft.planned_end || ''}
                min={draft.planned_start || activity.start || undefined}
                max={activity.end || undefined}
                optional
                onChange={(planned_end) => update({ planned_end })}
              />
              <RequiredFieldError id="task-end-error" show={missingEnd} />
            </label>
          </div>
        </div>
      </Panel>
      <Panel className="gap-0 overflow-hidden p-0">
        <h2 className="border-b border-border px-6 py-5">
          {strings.budgetAndWeight}
        </h2>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <label>
            {strings.operationAmount} *
            <ExactNumberInput
              aria-label={strings.taskPlannedAmount}
              aria-required="true"
              {...missingRequiredFieldProps(missingAmount, 'task-amount-error')}
              value={draft.allocation}
              onChange={(allocation) => update({ allocation })}
            />
            <RequiredFieldError id="task-amount-error" show={missingAmount} />
          </label>
          <label>
            {strings.taskWeightPercent} *
            <ExactNumberInput
              scale={2}
              min="0"
              max="100"
              step="0.01"
              aria-label={strings.taskWeightPercent}
              aria-required="true"
              {...missingRequiredFieldProps(missingWeight, 'task-weight-error')}
              value={draft.weight || ''}
              onChange={(weight) => update({ weight })}
            />
            <RequiredFieldError id="task-weight-error" show={missingWeight} />
          </label>
        </div>
      </Panel>
      <Panel className="gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
          <h2>
            {draft.subtasks.length
              ? strings.formatString(
                  strings.subtaskHeadingCount,
                  strings.subtasks,
                  draft.subtasks.length,
                )
              : strings.subtasks}
          </h2>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDrawerIndex(null)}
          >
            {strings.addSubtask}
          </Button>
        </div>
        <div className="p-6">
          {draft.subtasks.length ? (
            <div>
              <CompactAllocationTable
                rows={draft.subtasks}
                nameHeader={strings.subtask}
                amountHeader={strings.compactPlannedAmount}
                weightHeader={strings.weight}
                actionsHeader={strings.actions}
                datesToComplete={strings.datesToComplete}
                renderActions={(child, index) => (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDrawerIndex(index)}
                    >
                      {strings.modify}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(event) =>
                        setRemoval({
                          index,
                          opener: { current: event.currentTarget },
                          label: strings.removeSubtask,
                          message: strings.formatString(
                            strings.removeNamed,
                            child.name,
                          ),
                        })
                      }
                    >
                      {strings.remove}
                    </Button>
                  </div>
                )}
                footer={
                  <tr className="font-semibold">
                    <td className="px-3 pt-4">{strings.subtaskTotal}</td>
                    <td className="px-3 pt-4">
                      {formatXof(amountTotal)} / {formatXof(draft.allocation)}
                    </td>
                    <td className="px-3 pt-4">
                      {formatExactNumber(weightTotal / 100)} / 100 %
                    </td>
                    <td />
                  </tr>
                }
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{strings.noSubtask}</p>
          )}
        </div>
      </Panel>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {strings.cancel}
        </Button>
        <Button type="submit" disabled={pending}>
          {strings.saveTask}
        </Button>
      </div>
      {drawerIndex !== undefined && (
        <SubtaskDrawer
          task={draft}
          index={drawerIndex}
          submissionAttempted={submissionAttempted}
          onClose={() => setDrawerIndex(undefined)}
          onSave={(child) => {
            update({
              subtasks:
                drawerIndex === null
                  ? [...draft.subtasks, child]
                  : draft.subtasks.map((row, index) =>
                      index === drawerIndex ? child : row,
                    ),
            })
            setDrawerIndex(undefined)
          }}
        />
      )}
      <ConfirmRemoval
        removal={removal}
        onClose={() => setRemoval(null)}
        onConfirm={() => {
          update({
            subtasks: draft.subtasks.filter(
              (_, index) => index !== removal.index,
            ),
          })
          setRemoval(null)
        }}
      />
    </Panel>
  )
}

export function ActivityForm({
  year,
  projectId,
  onCreateType,
  types = [],
  typeResult,
  navigate,
  pending,
  optionsUnavailable = false,
  initial,
  onSubmit,
  onCancel,
}) {
  const suggestedStart =
    !initial && Number(year) === new Date().getFullYear()
      ? localDateInput()
      : ''
  const [name, setName] = useState(initial?.name || '')
  const [draftBase] = useState(initial)
  const [description, setDescription] = useState(initial?.description || '')
  const [amount, setAmount] = useState(initial?.allocation ?? '')
  const [start, setStart] = useState(initial?.planned_start || suggestedStart)
  const [end, setEnd] = useState(
    initial ? initial.planned_end || '' : addThreeMonths(suggestedStart),
  )
  const [tasks, setTasks] = useState(() =>
    (initial?.tasks || []).map((task) => ({
      ...task,
      _key: task.id || crypto.randomUUID(),
      subtasks: (task.subtasks || []).map((child) => ({
        ...child,
        _key: child.id || crypto.randomUUID(),
      })),
    })),
  )
  const [taskEditor, setTaskEditor] = useState(null)
  const taskSectionHeading = useRef(null)
  const [removal, setRemoval] = useState(null)
  const [file, setFile] = useState(null)
  const [attemptedSubmission, setAttemptedSubmission] = useState(false)
  const [attemptedDraft, setAttemptedDraft] = useState(false)
  const requestKey = useRef(initial ? null : crypto.randomUUID())
  const total = sumAmounts(tasks)
  const taskWeightTotal = tasks.reduce(
    (sum, task) => sum + percentagePoints(task.weight),
    0,
  )
  const problems = activitySubmissionProblems({
    name,
    start,
    end,
    amount,
    tasks,
  })
  const incompleteDraftProblems = draftProblems({
    name,
    start,
    end,
    amount,
    tasks,
  })
  const visibleProblems = attemptedSubmission
    ? problems
    : attemptedDraft
      ? incompleteDraftProblems
      : []
  const missingName = (attemptedSubmission || attemptedDraft) && !name.trim()
  const missingStart = attemptedSubmission && !start
  const missingEnd = attemptedSubmission && !end
  const missingAmount = attemptedSubmission && !positiveAmount(amount)
  const restoreActivityEditorFocus = () =>
    setTimeout(() => taskSectionHeading.current?.focus(), 0)

  if (taskEditor)
    return (
      <TaskEditor
        task={taskEditor.task}
        activity={{
          id: initial?.id,
          projectId: projectId || initial?.project_id,
          name,
          start,
          end,
          year,
        }}
        types={types}
        pending={pending}
        categoriesUnavailable={optionsUnavailable}
        typeResult={typeResult}
        navigate={navigate}
        onReturnToActivity={() => {
          setTaskEditor(null)
          restoreActivityEditorFocus()
        }}
        onCreateType={onCreateType}
        onCancel={() => {
          setTaskEditor(null)
          restoreActivityEditorFocus()
        }}
        onSave={(task) => {
          setTasks((current) =>
            taskEditor.index === null
              ? [...current, task]
              : current.map((row, index) =>
                  index === taskEditor.index ? task : row,
                ),
          )
          setTaskEditor(null)
          restoreActivityEditorFocus()
          toast.success(strings.taskKept)
        }}
        submissionAttempted={attemptedSubmission}
      />
    )

  return (
    <Panel
      as={BusinessForm}
      className="items-start gap-6 border-0 bg-transparent p-0 lg:grid-cols-[minmax(0,1fr)_280px]"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return false
        const intent = event.nativeEvent.submitter?.value || 'draft'
        if (intent === 'submit' && optionsUnavailable) return false
        if (intent === 'submit' && problems.length) {
          setAttemptedSubmission(true)
          setAttemptedDraft(false)
          return false
        }
        if (intent === 'draft' && incompleteDraftProblems.length) {
          setAttemptedDraft(true)
          setAttemptedSubmission(false)
          return false
        }
        const body = {
          name: name.trim(),
          description: description.trim(),
          planned_start: start || null,
          planned_end: end || null,
          allocation: amount || null,
          tasks: persistedTasks(tasks),
          ...(initial
            ? { expected_version: draftBase.version }
            : { request_key: requestKey.current }),
        }
        return file ? onSubmit(body, intent, file) : onSubmit(body, intent)
      }}
    >
      {visibleProblems.length > 0 && (
        <section
          role="alert"
          className="rounded-panel border border-warning bg-warning-soft p-5 text-warning lg:col-span-2"
        >
          <h2 className="font-semibold">{strings.submissionCorrections}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {visibleProblems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid min-w-0 gap-6">
        <Panel className="gap-0 overflow-hidden p-0">
          <h2 className="border-b border-border px-5 py-4">
            {strings.generalInformation}
          </h2>
          <div className="grid gap-5 p-5">
            <label>
              {strings.activityName} *
              <input
                aria-label={strings.activityName}
                aria-required="true"
                {...missingRequiredFieldProps(
                  missingName,
                  'activity-name-error',
                )}
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <RequiredFieldError id="activity-name-error" show={missingName} />
            </label>
            <label>
              {strings.description}
              <textarea
                aria-label={strings.description}
                maxLength={4000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>
        </Panel>
        <Panel className="gap-0 overflow-hidden p-0">
          <h2 className="border-b border-border px-5 py-4">
            {strings.planningTitle}
          </h2>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label>
              {strings.startDate} *
              <DatePicker
                label={strings.startDate}
                aria-required="true"
                {...missingRequiredFieldProps(
                  missingStart,
                  'activity-start-error',
                )}
                value={start}
                min={year ? `${year}-01-01` : undefined}
                max={year ? `${year}-12-31` : undefined}
                optional
                onChange={setStart}
              />
              <RequiredFieldError
                id="activity-start-error"
                show={missingStart}
              />
            </label>
            <label>
              {strings.endDate} *
              <DatePicker
                label={strings.endDate}
                aria-required="true"
                {...missingRequiredFieldProps(missingEnd, 'activity-end-error')}
                value={end}
                min={start || undefined}
                optional
                onChange={setEnd}
              />
              <RequiredFieldError id="activity-end-error" show={missingEnd} />
            </label>
          </div>
        </Panel>
        <Panel className="gap-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 ref={taskSectionHeading} tabIndex={-1}>
              {strings.operationsBudget}
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTaskEditor({ index: null, task: emptyTask() })
              }}
            >
              {strings.addOperation}
            </Button>
          </div>
          <div className="grid gap-5 p-5">
            <label className="max-w-80">
              {strings.plannedAmount} *
              <ExactNumberInput
                aria-label={strings.plannedAmount}
                aria-required="true"
                {...missingRequiredFieldProps(
                  missingAmount,
                  'activity-amount-error',
                )}
                value={amount}
                onChange={setAmount}
              />
              <RequiredFieldError
                id="activity-amount-error"
                show={missingAmount}
              />
            </label>
            {tasks.length ? (
              <CompactAllocationTable
                rows={tasks}
                nameHeader={strings.operation}
                amountHeader={strings.compactPlannedAmount}
                weightHeader={strings.weight}
                actionsHeader={strings.actions}
                datesToComplete={strings.datesToComplete}
                categoryFor={(task) =>
                  task.type_label ||
                  types.find((type) => type.id === task.type_id)?.label ||
                  strings.categoryToComplete
                }
                detailFor={(task) =>
                  task.subtasks?.length
                    ? ` · ${subtaskCountLabel(task.subtasks.length)}`
                    : ''
                }
                renderActions={(task, index) => (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTaskEditor({
                          index,
                          task: {
                            ...task,
                            subtasks: [...(task.subtasks || [])],
                          },
                        })
                      }}
                    >
                      {strings.modify}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(event) =>
                        setRemoval({
                          index,
                          opener: { current: event.currentTarget },
                          label: strings.removeTask,
                          message: strings.formatString(
                            strings.removeNamed,
                            task.name,
                          ),
                        })
                      }
                    >
                      {strings.remove}
                    </Button>
                  </div>
                )}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{strings.noTask}</p>
            )}
          </div>
        </Panel>
        <Panel className="gap-0 overflow-hidden p-0">
          <h2 className="border-b border-border px-5 py-4">
            {strings.attachments}
          </h2>
          <div className="p-5">
            <FileSelection
              label={strings.optionalFile}
              chooseLabel={strings.chooseFile}
              emptyLabel={strings.noFileSelected}
              file={file}
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </div>
        </Panel>
      </div>
      <Panel
        as="aside"
        className="gap-0 overflow-hidden p-0 lg:sticky lg:top-6"
      >
        <h2 className="border-b border-border px-5 py-4">
          {strings.distribution}
        </h2>
        <dl className="grid gap-5 p-5 text-sm">
          <div>
            <dt className="text-muted-foreground">
              {strings.activityBudgetSummary}
            </dt>
            <dd className="mt-1 font-semibold">{formatXof(amount)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{strings.operationTotal}</dt>
            <dd className="mt-1 font-semibold">{formatXof(total)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{strings.budgetRemaining}</dt>
            <dd className="mt-1 font-semibold">
              {positiveAmount(amount) ? formatXof(BigInt(amount) - total) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{strings.taskWeightTotal}</dt>
            <dd className="mt-1 font-semibold">
              {formatExactNumber(taskWeightTotal / 100)} / 100 %
            </dd>
          </div>
        </dl>
      </Panel>
      <div className="flex flex-wrap justify-end gap-3 lg:col-span-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            {strings.cancel}
          </Button>
        )}
        <Button
          type="submit"
          name="intent"
          value="draft"
          variant="outline"
          disabled={pending}
        >
          {strings.saveDraft}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending || optionsUnavailable}
        >
          {strings.submitReview}
        </Button>
      </div>
      <ConfirmRemoval
        removal={removal}
        onClose={() => setRemoval(null)}
        onConfirm={() => {
          setTasks((current) =>
            current.filter((_, index) => index !== removal.index),
          )
          setRemoval(null)
        }}
      />
    </Panel>
  )
}
