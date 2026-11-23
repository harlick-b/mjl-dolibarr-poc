import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { createContext, useContext } from 'react'
import { ActivityTimeline } from './ActivityTimeline'

const initialActivity = {
  id: 'activity-1',
  name: 'Formation initiale',
  reference: 'ACT-001',
  planned_start: '2026-01-03',
  planned_end: '2026-01-31',
  agents: ['Ancien Agent'],
}

const RowsContext = createContext([])

function TimelineScreen() {
  const rows = useContext(RowsContext)
  return (
    <ActivityTimeline
      rows={rows}
      year={2026}
      month={1}
      onMonth={() => {}}
      hasFilters={false}
    />
  )
}

function renderTimeline(rows) {
  let currentRows = rows
  const rootRoute = createRootRoute({ component: Outlet })
  const timelineRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: TimelineScreen,
  })
  const activityRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/planning/activities/$activityId',
    component: () => null,
  })
  const executionActivityRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/execution/activities/$activityId',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      timelineRoute,
      activityRoute,
      executionActivityRoute,
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const view = () => (
    <RowsContext.Provider value={currentRows}>
      <RouterProvider router={router} />
    </RowsContext.Provider>
  )
  const rendered = render(view())
  return {
    router,
    ...rendered,
    renderRows(nextRows) {
      currentRows = nextRows
      rendered.rerender(view())
    },
  }
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})

afterEach(() => {
  delete HTMLDialogElement.prototype.showModal
  delete HTMLDialogElement.prototype.close
})

test('an open Activity preview follows the current timeline result', async () => {
  const user = userEvent.setup()
  const { renderRows } = renderTimeline([initialActivity])

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(await screen.findAllByText('Formation initiale')).toHaveLength(1)
  const timelinePeriod = screen.getByText('janvier 2026').closest('p')

  await user.click(
    await screen.findByRole('button', {
      name: /Formation initiale.*Afficher les dates et les responsables/,
    }),
  )
  expect(
    screen.getByRole('dialog', { name: 'Formation initiale' }),
  ).toHaveTextContent('Ancien Agent')

  const refreshed = {
    ...initialActivity,
    name: 'Formation actualisée',
    reference: 'ACT-002',
    agents: ['Nouvel Agent'],
  }
  renderRows([refreshed])

  const preview = screen.getByRole('dialog', { name: 'Formation actualisée' })
  expect(within(preview).getByText(/ACT-002/)).toBeVisible()
  expect(within(preview).getByText('Nouvel Agent')).toBeVisible()
  expect(within(preview).queryByText('Ancien Agent')).not.toBeInTheDocument()

  renderRows([])
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(timelinePeriod).toHaveFocus()
})

test('an Activity with an approved baseline links directly to Execution', async () => {
  renderTimeline([
    { ...initialActivity, approved_revision_id: 'approved-revision-1' },
  ])

  expect(
    await screen.findByRole('link', { name: 'Formation initiale' }),
  ).toHaveAttribute('href', '/execution/activities/activity-1')
})
