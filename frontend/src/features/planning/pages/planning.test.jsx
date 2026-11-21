import { selectOption } from '@/test/select-option'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { App, makeRouter } from '@/app/router'
import { ActivityForm } from './PlanningView'
import { physicalExecutionLabel } from '../lib/physical-execution'
import {
  addThreeMonths,
  formatDate,
  formatExactPercentage,
  formatPercentage,
  localDateInput,
} from '@/shared/lib/format'

afterEach(() => {
  toast.dismiss()
  window.dispatchEvent(new Event('online'))
  vi.unstubAllGlobals()
})

test.each([
  ['2027-01-31', '2027-04-30'],
  ['2027-02-28', '2027-05-28'],
  ['2027-08-31', '2027-11-30'],
  ['2026-11-30', '2027-02-28'],
  ['2027-11-30', '2028-02-29'],
])(
  'adds three calendar months to %s without timezone arithmetic',
  (start, end) => {
    expect(addThreeMonths(start)).toBe(end)
  },
)

test('formats annual rates without capping and preserves zero denominators', () => {
  expect(formatPercentage('11', '10')).toBe('110 %')
  expect(formatPercentage('1', '3')).toBe('33,3 %')
  expect(formatPercentage('0', '0')).toBe('Non calculable')
})

test.each([
  [null, '—'],
  [{ realization_status: 'not_started', progress: null }, 'Non démarrée'],
  [{ realization_status: 'in_progress', progress: '0.00' }, 'En cours'],
  [{ realization_status: 'in_progress', progress: '37.50' }, '37,5 %'],
  [
    {
      realization_status: 'completed_pending_validation',
      progress: '100.00',
    },
    'Terminée',
  ],
  [{ realization_status: 'validated', progress: '100.00' }, 'Terminée'],
])('formats physical execution as one meaningful value', (execution, label) => {
  expect(physicalExecutionLabel(execution)).toBe(label)
})

test('formats stored progress without API trailing zeros', () => {
  expect(formatExactPercentage('20.00')).toBe('20 %')
  expect(formatExactPercentage('20.50')).toBe('20,5 %')
  expect(formatExactPercentage('invalid')).toBe('—')
})

test('an approved Activity shows its due administrative reminder without repeating dates in Programming', async () => {
  const end = new Date()
  end.setDate(end.getDate() + 10)
  const plannedEnd = localDateInput(end)
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  const plannedStart = localDateInput(start)
  const activity = {
    id: 'reminder-activity',
    pta_id: 'pta-1',
    project_id: 'project-1',
    project_name: 'Projet enfance',
    partner_name: 'UNICEF',
    pta_name: 'PTA 2026',
    placement_year: end.getFullYear(),
    reference: 'ACT-REMINDER',
    name: 'Formation des relais',
    description: 'Former les relais communautaires.',
    planned_start: plannedStart,
    planned_end: plannedEnd,
    allocation: '1000000',
    state: 'approved',
    version: 4,
    current_revision_id: 'revision-1',
    approved_revision_id: 'revision-1',
    approved_allocation: '1000000',
    approved: { planned_start: plannedStart, planned_end: plannedEnd },
    candidate: null,
    amendment: null,
    withdrawal: null,
    transfer: null,
    closure: null,
    execution_paused: false,
    tasks: [],
    correction: null,
    agent_ids: ['agent'],
    agents: [
      {
        id: 'agent',
        email: 'aicha@example.test',
        full_name: 'Aïcha Agent',
      },
    ],
    creator: {
      id: 'supervisor',
      email: 'supervisor@example.test',
      full_name: 'Sali Superviseure',
    },
    allowed_actions: ['read'],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'aicha@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (path.endsWith('/activities/reminder-activity'))
        return new Response(JSON.stringify(activity))
      if (path.endsWith('/activities/reminder-activity/execution'))
        return new Response(
          JSON.stringify({
            realization_status: 'not_started',
            progress: null,
            closure: null,
          }),
        )
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        }),
      )
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: ['/activities/reminder-activity'],
        }),
      )}
    />,
  )

  const reminder = await screen.findByRole('heading', {
    name: 'Relance administrative',
  })
  const reminderCard = reminder.closest('aside')
  expect(within(reminderCard).getByText('Échéance')).toBeVisible()
  expect(within(reminderCard).getByText(formatDate(plannedEnd))).toBeVisible()
  expect(within(reminderCard).getByText('Aïcha Agent')).toBeVisible()
  expect(within(reminderCard).getByText(/Relance prévue le/)).toBeVisible()

  const programmingCard = screen
    .getByRole('heading', { name: 'Programmation' })
    .closest('section')
  expect(within(programmingCard).queryByText('Début prévu')).toBeNull()
  expect(within(programmingCard).queryByText('Fin prévue')).toBeNull()
})

function annualPageFetch(exportReply, role = 'AGENT_SAISIE') {
  return vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.endsWith('/ptas/pta-1/exports')) return exportReply(options)
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role,
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.includes('/projects/project-1/ptas/2027'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            project: {
              id: 'project-1',
              name: 'Projet métriques',
              allowed_actions: ['read'],
            },
            year: 2027,
            pta: {
              id: 'pta-1',
              name: 'PTA Justice 2027',
              description: 'Programme annuel de protection',
            },
            allowed_actions: ['read', 'create_activity'],
            approved_plan: { activity_count: 5, allocation: '9200000' },
            summary: {
              activities: 9,
              approved: 5,
              review: 2,
              correction: 1,
              draft: 1,
              approved_allocation: '9200000',
            },
          }),
        ),
      )
    if (path.endsWith('/ptas/pta-1/metrics'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            pta_id: 'pta-1',
            as_of: '2027-10-30T10:00:00Z',
            physical: { closed_activities: 1, approved_activities: 5 },
            financial: {
              closed_spending: '1000000',
              approved_allocation: '9200000',
            },
          }),
        ),
      )
    if (path.includes('/ptas/pta-1/activity-agents'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 1,
            data: [
              {
                id: '00000000-0000-0000-0000-000000000001',
                label: 'Aïcha Agent',
              },
            ],
            next: null,
            previous: null,
          }),
        ),
      )
    return Promise.resolve(
      new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        }),
      ),
    )
  })
}

function renderAnnualPage(path = '/projects/project-1/ptas/2027') {
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: [path],
        }),
      )}
    />,
  )
}

test('the annual plan stays in page loading until its Activity list is ready', async () => {
  let resolveActivities
  const baseFetch = annualPageFetch(vi.fn())
  const fetch = vi.fn((url, options) => {
    if (String(url).includes('/ptas/pta-1/activities'))
      return new Promise((resolve) => {
        resolveActivities = resolve
      })
    return baseFetch(url, options)
  })
  vi.stubGlobal('fetch', fetch)
  renderAnnualPage()

  await waitFor(() => expect(resolveActivities).toBeTypeOf('function'))
  expect(
    screen.getByRole('status', {
      name: 'Chargement : Planification des activités sur l’année',
    }),
  ).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'PTA Justice 2027' })).toBeNull()

  resolveActivities(
    new Response(
      JSON.stringify({
        object: 'list',
        count: 0,
        data: [],
        next: null,
        previous: null,
      }),
    ),
  )
  const heading = await screen.findByRole('heading', {
    name: 'Projet métriques',
  })
  expect(heading).toBeVisible()
  const header = heading.closest('header')
  expect(header).toHaveTextContent('PTA 2027 · Programme annuel de protection')
  expect(screen.queryByRole('heading', { name: 'PTA Justice 2027' })).toBeNull()
})

test('the annual plan shows whole-PTA planning counts and approved budget', async () => {
  const user = userEvent.setup()
  const createObjectURL = vi.fn(() => 'blob:pta-export')
  const revokeObjectURL = vi.fn()
  const anchorClick = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL,
    revokeObjectURL,
  })
  const fetch = annualPageFetch(() =>
    Promise.resolve(
      new Response('csv', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="pta-2027-test.csv"',
        },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  renderAnnualPage()

  const metrics = await screen.findByRole('region', {
    name: 'Synthèse du PTA',
  })
  expect(within(metrics).getByText('Activités planifiées')).toBeVisible()
  expect(within(metrics).getByText('9')).toBeVisible()
  expect(within(metrics).getByText('Approuvées')).toBeVisible()
  expect(within(metrics).getByText('5')).toBeVisible()
  expect(within(metrics).getByText(/9.*200.*000/)).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Exporter le PTA en CSV' }),
  )
  await waitFor(() => expect(anchorClick).toHaveBeenCalledOnce())
  const exportCall = fetch.mock.calls.find(([url]) =>
    String(url).endsWith('/ptas/pta-1/exports'),
  )
  expect(exportCall[1]).toEqual(
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ format: 'csv' }),
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf' }),
    }),
  )
  expect(createObjectURL).toHaveBeenCalledOnce()
  await waitFor(() =>
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pta-export'),
  )
})

test('a Supervisor starts with the full Activity list and two review shortcuts', async () => {
  const fetch = annualPageFetch(vi.fn(), 'AGENT_VERIFICATEUR')
  vi.stubGlobal('fetch', fetch)
  renderAnnualPage()

  await screen.findByRole('region', { name: 'Synthèse du PTA' })
  expect(
    screen.getByRole('button', { name: /Agent affecté · 0/ }),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Soumise pour prévalidation' }),
  ).toHaveAttribute('aria-pressed', 'false')
  expect(
    screen.getByRole('button', { name: 'Validation définitive attendue' }),
  ).toHaveAttribute('aria-pressed', 'false')
  expect(
    screen.queryByRole('button', { name: 'En correction' }),
  ).not.toBeInTheDocument()
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) => {
        const request = new URL(String(url), 'http://localhost')
        return (
          request.pathname.endsWith('/ptas/pta-1/activities') &&
          !request.searchParams.has('state') &&
          !request.searchParams.has('review')
        )
      }),
    ).toBe(true),
  )
})

test('the PTA list names the pending decision and exposes the matching review action', async () => {
  const baseFetch = annualPageFetch(vi.fn(), 'VALIDATEUR_DEFINITIF')
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      if (String(url).includes('/ptas/pta-1/activities'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 1,
              data: [
                {
                  id: 'activity-review',
                  name: 'Formation des relais',
                  reference: 'ACT-2027-004',
                  planned_start: '2027-02-01',
                  planned_end: '2027-02-28',
                  allocation: '250000',
                  operation_count: 2,
                  agents: ['Aïcha Agent'],
                  state: 'prevalidated',
                  review_action: 'approve',
                },
              ],
              next: null,
              previous: null,
            }),
          ),
        )
      return baseFetch(url, options)
    }),
  )
  renderAnnualPage()

  expect(await screen.findByText('Décision finale attendue')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Valider' })).toBeVisible()
})

test('the PTA list keeps an ineligible prevalidated Activity read-only', async () => {
  const baseFetch = annualPageFetch(vi.fn(), 'AGENT_SAISIE')
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      if (String(url).includes('/ptas/pta-1/activities'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 1,
              data: [
                {
                  id: 'activity-read-only',
                  name: 'Formation des relais',
                  reference: 'ACT-2027-004',
                  planned_start: '2027-02-01',
                  planned_end: '2027-02-28',
                  allocation: '250000',
                  operation_count: 2,
                  agents: ['Aïcha Agent'],
                  state: 'prevalidated',
                  review_action: null,
                },
              ],
              next: null,
              previous: null,
            }),
          ),
        )
      return baseFetch(url, options)
    }),
  )
  renderAnnualPage()

  expect(await screen.findByText('Décision finale attendue')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Consulter' })).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Valider' })).toBeNull()
})

test('an Agent filter from the URL resolves its label beside Filters', async () => {
  const fetch = annualPageFetch(vi.fn(), 'AGENT_VERIFICATEUR')
  vi.stubGlobal('fetch', fetch)
  renderAnnualPage(
    '/projects/project-1/ptas/2027?agent=00000000-0000-0000-0000-000000000001',
  )

  await screen.findByRole('region', { name: 'Synthèse du PTA' })
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) =>
        String(url).includes('agent=00000000-0000-0000-0000-000000000001'),
      ),
    ).toBe(true),
  )

  const chip = await screen.findByRole('button', {
    name: 'Retirer le filtre Agent affecté',
  })
  expect(chip).toHaveTextContent('Aïcha Agent ×')
  expect(
    screen.getByRole('button', { name: 'Agent affecté · 1' }),
  ).toBeVisible()
})

test.each([
  ['xlsx', 'Excel'],
  ['pdf', 'PDF'],
])(
  'annual %s uses the selected PTA and protected download',
  async (format, label) => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const createObjectURL = vi.fn(() => 'blob:xlsx')
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    const fetch = annualPageFetch(() =>
      Promise.resolve(
        new Response('xlsx', {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="pta-2027-test.${format}"`,
          },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetch)
    renderAnnualPage()
    fireEvent.click(
      await screen.findByRole('button', {
        name: `Rapport de travail ${label}`,
      }),
    )
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    const request = fetch.mock.calls.find(([url]) =>
      String(url).endsWith('/ptas/pta-1/exports'),
    )[1]
    expect(request.method).toBe('POST')
    expect(JSON.parse(request.body)).toEqual({ format })
    expect(request.headers['X-CSRF-Token']).toBe('csrf')
    expect(anchorClick.mock.instances.at(-1).download).toBe(
      `pta-2027-test.${format}`,
    )
  },
)

test('an offline annual export is neither sent nor replayed', async () => {
  const user = userEvent.setup()
  const online = vi.spyOn(window.navigator, 'onLine', 'get')
  const createObjectURL = vi.fn()
  let exportSignal
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
  const fetch = annualPageFetch(
    (options) =>
      new Promise((_resolve, reject) => {
        exportSignal = options.signal
        options.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        )
      }),
  )
  vi.stubGlobal('fetch', fetch)
  renderAnnualPage()
  await screen.findByRole('region', { name: 'Synthèse du PTA' })

  online.mockReturnValue(false)
  await user.click(
    screen.getByRole('button', { name: 'Exporter le PTA en CSV' }),
  )
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Connexion indisponible',
    ),
  )
  expect(
    fetch.mock.calls.filter(([url]) =>
      String(url).endsWith('/ptas/pta-1/exports'),
    ),
  ).toHaveLength(0)
  expect(createObjectURL).not.toHaveBeenCalled()

  online.mockReturnValue(true)
  window.dispatchEvent(new Event('online'))
  await user.click(
    screen.getByRole('button', { name: 'Exporter le PTA en CSV' }),
  )
  await waitFor(() => expect(exportSignal).toBeDefined())
  online.mockReturnValue(false)
  window.dispatchEvent(new Event('offline'))
  expect(
    await screen.findByRole('heading', { name: 'Connexion indisponible' }),
  ).toBeVisible()
  await waitFor(() => expect(exportSignal.aborted).toBe(true))
  expect(
    fetch.mock.calls.filter(([url]) =>
      String(url).endsWith('/ptas/pta-1/exports'),
    ),
  ).toHaveLength(1)
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.queryByText('Export CSV téléchargé.')).not.toBeInTheDocument()
  online.mockReturnValue(true)
  window.dispatchEvent(new Event('online'))
  online.mockRestore()
})

test('a denied annual export does not invalidate the session', async () => {
  const user = userEvent.setup()
  const createObjectURL = vi.fn()
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
  const fetch = annualPageFetch(() =>
    Promise.resolve(
      new Response(JSON.stringify({ code: 'forbidden' }), { status: 403 }),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  renderAnnualPage()
  await screen.findByRole('region', { name: 'Synthèse du PTA' })

  await user.click(
    screen.getByRole('button', { name: 'Exporter le PTA en CSV' }),
  )
  await waitFor(() => expect(createObjectURL).not.toHaveBeenCalled())
  expect(
    fetch.mock.calls.filter(([url]) =>
      String(url).endsWith('/ptas/pta-1/exports'),
    ),
  ).toHaveLength(1)
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.queryByText('Export CSV téléchargé.')).not.toBeInTheDocument()
})

test('an eligible Agent confirms submission of the current Activity version', async () => {
  const user = userEvent.setup()
  let submittedActivityReads = 0
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  let activity = {
    id: 'activity-1',
    pta_id: 'pta-1',
    project_id: 'project-1',
    reference: 'ACT-000001',
    name: 'Atelier',
    description: 'Préparation de l’atelier',
    planned_start: '2027-01-10',
    planned_end: '2027-04-10',
    allocation: '100000',
    state: 'draft',
    version: 1,
    current_revision_id: null,
    approved_revision_id: null,
    approved_allocation: null,
    tasks: [
      {
        id: 'operation-1',
        type_id: 'type-1',
        name: 'Préparer',
        description: 'Préparer la logistique complète.',
        allocation: '100000',
        weight: '100.00',
        position: 1,
        planned_start: '2027-01-10',
        planned_end: '2027-04-10',
        subtasks: [
          {
            id: 'subtask-1',
            name: 'Réserver la salle',
            description: 'Confirmer le lieu.',
            allocation: '100000',
            weight: '100.00',
            position: 1,
            planned_start: '2027-01-10',
            planned_end: '2027-02-10',
          },
        ],
      },
    ],
    agent_ids: ['agent'],
    allowed_actions: ['read', 'edit', 'submit'],
  }
  const revision = {
    id: 'revision-1',
    revision_number: 1,
    activity_version: 2,
  }
  const fetch = vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    if (url === '/api/v1/auth/session' && method === 'GET')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (
      url === '/api/v1/activities/activity-1/submissions' &&
      method === 'POST'
    ) {
      activity = {
        ...activity,
        state: 'submitted',
        version: 2,
        current_revision_id: revision.id,
        current_revision_number: 1,
        current_submitter: {
          id: 'agent',
          email: 'user@example.test',
          full_name: 'Agent de test',
        },
        allowed_actions: ['read'],
      }
      return Promise.resolve(
        new Response(JSON.stringify(revision), { status: 201 }),
      )
    }
    if (url === '/api/v1/activities/activity-1' && method === 'GET') {
      if (activity.state === 'submitted') submittedActivityReads += 1
      return Promise.resolve(new Response(JSON.stringify(activity)))
    }
    throw new Error(`Unexpected request in submission flow: ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/activities/activity-1'] }),
  )
  render(<App router={router} />)
  await user.click(
    await screen.findByRole('button', { name: 'Soumettre pour prévalidation' }),
  )
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/submissions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expected_version: 1 }),
      }),
    ),
  )
  expect((await screen.findAllByText('À prévalider'))[0]).toBeVisible()
  expect(submittedActivityReads).toBeGreaterThanOrEqual(1)
  expect(
    screen.queryByRole('button', { name: 'Soumettre pour prévalidation' }),
  ).not.toBeInTheDocument()
})

test('an Agent opens and cancels an amendment while the approved version stays visible', async () => {
  const user = userEvent.setup()
  const createObjectURL = vi.fn(() => 'blob:preview')
  const revokeObjectURL = vi.fn()
  const NativeURL = URL
  class PreviewURL extends NativeURL {}
  PreviewURL.createObjectURL = createObjectURL
  PreviewURL.revokeObjectURL = revokeObjectURL
  vi.stubGlobal('URL', PreviewURL)
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  const approved = {
    name: 'Atelier approuvé',
    description: 'Version approuvée',
    planned_start: '2027-01-10',
    planned_end: '2027-04-10',
    allocation: '100000',
    tasks: [
      {
        id: 'operation-1',
        type_id: 'type-1',
        name: 'Préparer',
        description: 'Préparer la logistique complète.',
        allocation: '100000',
        weight: '100.00',
        position: 1,
        planned_start: '2027-01-10',
        planned_end: '2027-04-10',
        subtasks: [
          {
            id: 'subtask-1',
            name: 'Réserver la salle',
            description: 'Confirmer le lieu.',
            allocation: '100000',
            weight: '100.00',
            position: 1,
            planned_start: '2027-01-10',
            planned_end: '2027-02-10',
          },
        ],
      },
    ],
  }
  let activity = {
    id: 'activity-1',
    pta_id: 'pta-1',
    project_id: 'project-1',
    reference: 'ACT-000001',
    ...approved,
    state: 'approved',
    version: 4,
    current_revision_id: 'revision-1',
    approved_revision_id: 'revision-1',
    approved_allocation: '100000',
    approved,
    candidate: null,
    amendment: null,
    withdrawal: null,
    transfer: null,
    placement_year: 2027,
    execution_paused: false,
    tasks: approved.tasks,
    correction: null,
    agent_ids: ['agent'],
    allowed_actions: [
      'read',
      'open_amendment',
      'request_withdrawal',
      'request_transfer',
    ],
  }
  let documents = []
  let previewStatus = 200
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/documents/document-1/preview'))
      return Promise.resolve(
        new Response(previewStatus === 200 ? 'png' : '{}', {
          status: previewStatus,
        }),
      )
    if (
      path.endsWith('/documents/document-2/withdrawal') &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      documents = documents.map((document) =>
        document.id === 'document-2'
          ? {
              ...document,
              withdrawal: {
                reason: body.reason,
                withdrawn_by_id: 'agent',
                withdrawn_at: '2027-01-02T11:00:00Z',
                replacement_document_id: body.replacement_document_id,
                replacement_document_name: 'preuve.png',
              },
              allowed_actions: [],
            }
          : document,
      )
      return Promise.resolve(
        new Response(JSON.stringify({ code: 'document_withdrawn' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    if (path.endsWith('/activities/activity-1/documents?limit=60'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: [
              {
                id: 'document-newest',
                activity_id: 'activity-1',
                name: 'autre-piece.png',
                media_type: 'image/png',
                size: 3,
                uploaded_by_id: 'agent',
                uploaded_at: '2027-01-02T12:00:00Z',
                withdrawal: null,
                allowed_actions: ['withdraw'],
              },
            ],
            next: 'https://mjl.test/api/v1/activities/activity-1/documents?limit=60&cursor=candidate-next',
            previous: null,
          }),
        ),
      )
    if (
      path.endsWith(
        '/activities/activity-1/documents?limit=60&cursor=candidate-next',
      )
    )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: documents.filter((document) => document.id === 'document-1'),
            next: null,
            previous:
              'https://mjl.test/api/v1/activities/activity-1/documents?limit=60',
          }),
        ),
      )
    if (path.endsWith('/activities/activity-1/documents?cursor=older'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: documents.length,
            data: documents.filter((document) => document.id === 'document-2'),
            next: null,
            previous: '/api/v1/activities/activity-1/documents',
          }),
        ),
      )
    if (path.endsWith('/activities/activity-1/documents')) {
      if (options.method === 'POST') {
        documents = [
          {
            id: 'document-1',
            activity_id: 'activity-1',
            name: 'preuve.png',
            media_type: 'image/png',
            size: 3,
            uploaded_by_id: 'agent',
            uploaded_at: '2027-01-02T10:00:00Z',
            withdrawal: null,
            allowed_actions: ['withdraw'],
          },
          {
            id: 'document-2',
            activity_id: 'activity-1',
            name: 'preuve.pdf',
            media_type: 'application/pdf',
            size: 3,
            uploaded_by_id: 'agent',
            uploaded_at: '2027-01-02T09:00:00Z',
            withdrawal: null,
            allowed_actions: ['withdraw'],
          },
        ]
        return Promise.resolve(
          new Response(JSON.stringify(documents[0]), { status: 201 }),
        )
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: documents.length,
            data: documents,
            next: null,
            previous: null,
          }),
        ),
      )
    }
    if (
      path.endsWith('/activities/activity-1/amendments') &&
      options.method === 'POST'
    ) {
      activity = {
        ...activity,
        state: 'amendment_draft',
        version: 5,
        amendment: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          reason: 'Adapter.',
        },
        candidate: { ...approved, description: 'Version candidate' },
        execution_paused: true,
        allowed_actions: ['read', 'edit', 'submit', 'cancel_amendment'],
      }
      return Promise.resolve(
        new Response(JSON.stringify(activity), { status: 201 }),
      )
    }
    if (
      path.endsWith('/activities/activity-1/withdrawals') &&
      options.method === 'POST'
    ) {
      activity = {
        ...activity,
        state: 'submitted',
        version: 7,
        current_revision_id: 'revision-withdrawal',
        withdrawal: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          reason: 'Retrait justifié.',
        },
        execution_paused: true,
        allowed_actions: ['read', 'cancel_withdrawal'],
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'revision-withdrawal',
            activity_version: 7,
          }),
          { status: 201 },
        ),
      )
    }
    if (
      path.endsWith('/activities/activity-1/transfers') &&
      options.method === 'POST'
    ) {
      activity = {
        ...activity,
        state: 'submitted',
        version: 9,
        current_revision_id: 'revision-transfer',
        transfer: {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          reason: 'Calendrier 2028.',
          source_pta: { id: 'pta-1', year: 2027 },
          target_year: 2028,
        },
        execution_paused: true,
        allowed_actions: ['read', 'cancel_transfer'],
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ id: 'revision-transfer', activity_version: 9 }),
          { status: 201 },
        ),
      )
    }
    if (path.includes('/cancellation') && options.method === 'POST') {
      const withdrawalCancellation = path.includes('/withdrawals/')
      const transferCancellation = path.includes('/transfers/')
      activity = {
        ...activity,
        state: 'approved',
        version: transferCancellation ? 10 : withdrawalCancellation ? 8 : 6,
        current_revision_id: 'revision-1',
        amendment: null,
        withdrawal: null,
        transfer: null,
        candidate: null,
        tasks: approved.tasks.map((task) => ({ ...task, subtasks: [] })),
        execution_paused: false,
        allowed_actions: [
          'read',
          'open_amendment',
          'request_withdrawal',
          'request_transfer',
        ],
      }
      return Promise.resolve(new Response(JSON.stringify(activity)))
    }
    if (path.endsWith('/activities/activity-1'))
      return Promise.resolve(new Response(JSON.stringify(activity)))
    if (path.includes('/activities/activity-1/revisions'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    return Promise.resolve(
      new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        }),
      ),
    )
  })
  vi.stubGlobal('fetch', fetch)
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/activities/activity-1'] }),
  )
  const accessKey = ['access', 'admin', 'users', {}]
  router.options.context.queryClient.setQueryData(accessKey, { items: [] })
  render(<App router={router} />)
  const activitySheet = await screen.findByRole('button', {
    name: 'Fiche récapitulative',
  })
  expect(activitySheet).toBeVisible()
  expect(activitySheet).toHaveClass('rounded-card')
  expect(activitySheet.querySelector('svg')).toBeNull()
  await user.click(
    screen.getByRole('link', { name: 'Pièces justificatives', exact: true }),
  )
  expect(await screen.findByText('Aucune pièce justificative')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Ajouter une pièce' }))
  await user.upload(
    screen.getByLabelText('Choisir un fichier PDF, JPEG ou PNG *'),
    new File(['png'], 'preuve.png', { type: 'image/png' }),
  )
  const online = vi.spyOn(window.navigator, 'onLine', 'get')
  online.mockReturnValue(false)
  fireEvent.submit(
    screen.getByRole('dialog').querySelector('button[type="submit"]').form,
  )
  expect(
    await screen.findByText('Connexion indisponible. Aucune action envoyée.'),
  ).toBeVisible()
  expect(
    fetch.mock.calls.filter(
      ([url, options]) =>
        String(url).endsWith('/activities/activity-1/documents') &&
        options?.method === 'POST',
    ),
  ).toHaveLength(0)
  online.mockReturnValue(true)
  window.dispatchEvent(new Event('online'))
  await act(async () => Promise.resolve())
  expect(
    fetch.mock.calls.filter(
      ([url, options]) =>
        String(url).endsWith('/activities/activity-1/documents') &&
        options?.method === 'POST',
    ),
  ).toHaveLength(0)
  fireEvent.submit(
    screen.getByRole('dialog').querySelector('button[type="submit"]').form,
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Ajouter une pièce' }),
    ).not.toBeInTheDocument(),
  )
  const imageRow = (await screen.findByText('preuve.png')).closest('li')
  expect(
    within(imageRow).getByRole('button', { name: 'Télécharger' }),
  ).toBeVisible()
  const previewButton = within(imageRow).getByRole('button', {
    name: 'Aperçu de preuve.png',
  })
  online.mockReturnValue(false)
  await user.click(previewButton)
  let preview = screen.getByRole('dialog', { name: 'Aperçu — preuve.png' })
  expect(await within(preview).findByRole('alert')).toHaveTextContent(
    'Connexion indisponible',
  )
  expect(
    fetch.mock.calls.filter(([url]) => String(url).endsWith('/preview')),
  ).toHaveLength(0)
  await user.click(
    within(preview).getAllByRole('button', { name: 'Fermer' })[0],
  )
  online.mockReturnValue(true)
  await user.click(previewButton)
  preview = screen.getByRole('dialog', { name: 'Aperçu — preuve.png' })
  expect(
    await within(preview).findByRole('img', { name: 'Aperçu de preuve.png' }),
  ).toHaveAttribute('src', 'blob:preview')
  expect(createObjectURL).toHaveBeenCalledOnce()
  expect(
    fetch.mock.calls.filter(([url]) => String(url).endsWith('/preview')),
  ).toHaveLength(1)
  expect(
    within(preview).getByRole('button', { name: 'Télécharger' }),
  ).toBeVisible()
  await user.click(
    within(preview).getAllByRole('button', { name: 'Fermer' })[0],
  )
  expect(preview).not.toBeVisible()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  await act(async () => {
    await router.navigate({
      to: '/activities/$activityId',
      params: { activityId: 'activity-1' },
      search: (previous) => ({ ...previous, documentCursor: 'older' }),
    })
  })
  await waitFor(() => expect(screen.queryByText('preuve.png')).toBeNull())
  const pdfRow = screen.getByText('preuve.pdf').closest('li')
  expect(within(pdfRow).queryByRole('button', { name: /Aperçu/ })).toBeNull()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/documents',
    expect.objectContaining({
      method: 'POST',
      body: expect.any(File),
      headers: expect.objectContaining({
        'Content-Type': 'image/png',
        'X-File-Name': 'preuve.png',
      }),
    }),
  )
  await user.click(
    within(pdfRow).getByRole('button', { name: 'Retirer la pièce' }),
  )
  const withdrawalDialog = screen.getByRole('dialog', {
    name: 'Retirer la pièce',
  })
  await user.type(
    within(withdrawalDialog).getByLabelText('Motif du retrait *'),
    'Pièce incorrecte.',
  )
  expect(
    within(withdrawalDialog).queryByRole('option', { name: 'preuve.png' }),
  ).toBeNull()
  await user.click(
    within(withdrawalDialog).getByRole('button', { name: 'Suivant' }),
  )
  await user.click(within(withdrawalDialog).getByLabelText('Pièce corrigée'))
  await user.click(await screen.findByRole('option', { name: 'preuve.png' }))
  online.mockReturnValue(false)
  await user.click(
    within(withdrawalDialog).getByRole('button', { name: 'Retirer' }),
  )
  expect(
    fetch.mock.calls.filter(([url]) =>
      String(url).endsWith('/documents/document-2/withdrawal'),
    ),
  ).toHaveLength(0)
  online.mockReturnValue(true)
  window.dispatchEvent(new Event('online'))
  await user.click(
    within(withdrawalDialog).getByRole('button', { name: 'Retirer' }),
  )
  const withdrawnStatus = await screen.findByText(/Pièce retirée/)
  const withdrawnRow = withdrawnStatus.closest('li')
  expect(
    within(withdrawnRow).queryByRole('link', { name: 'Télécharger' }),
  ).toBeNull()
  expect(
    within(withdrawnRow).queryByRole('button', { name: /Aperçu/ }),
  ).toBeNull()
  expect(withdrawnRow).toHaveTextContent('Pièce incorrecte.')
  expect(withdrawnRow).toHaveTextContent('Remplacée par preuve.png')
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/documents/document-2/withdrawal',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        reason: 'Pièce incorrecte.',
        replacement_document_id: 'document-1',
      }),
    }),
  )
  await act(async () => {
    await router.navigate({
      to: '/activities/$activityId',
      params: { activityId: 'activity-1' },
      search: (previous) => ({
        ...previous,
        tab: 'programming',
        documentCursor: undefined,
      }),
    })
  })
  const amendmentButton = await screen.findByRole('button', {
    name: 'Demander une modification',
  })
  const activityHeader = screen
    .getByRole('heading', { name: 'Atelier approuvé' })
    .closest('[data-ui="activity-header"]')
  expect(
    within(activityHeader).queryByRole('button', {
      name: 'Demander une modification',
    }),
  ).not.toBeInTheDocument()
  await user.click(amendmentButton)
  await user.type(
    screen.getByLabelText('Motif de la modification *'),
    'Adapter.',
  )
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  expect(
    await screen.findByText(/exécution de cette activité est suspendue/i),
  ).toBeVisible()
  const approvedRegion = screen.getByRole('region', {
    name: 'Informations approuvées',
  })
  const candidateRegion = screen.getByRole('region', {
    name: 'Modification en préparation',
  })
  for (const region of [approvedRegion, candidateRegion]) {
    expect(region).toBeVisible()
    expect(
      within(region).queryByText('Préparer la logistique complète.'),
    ).not.toBeInTheDocument()
    expect(
      within(region).queryByText('Réserver la salle'),
    ).not.toBeInTheDocument()
    expect(within(region).getByText('100 %')).toBeVisible()
    expect(
      within(region).getByText('10 janvier 2027 – 10 avril 2027'),
    ).toBeVisible()
  }
  expect(screen.queryByText('Prochaine étape')).not.toBeInTheDocument()
  activity = { ...activity, state: 'returned_validator' }
  await act(async () => {
    router.options.context.queryClient.setQueryData(
      ['planning', 'agent', 'activity', 'activity-1'],
      activity,
    )
  })
  expect(screen.queryByText('Prochaine étape')).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Annuler la modification' }),
  )
  await user.type(
    screen.getByLabelText('Motif de l’annulation *'),
    'Retour au socle.',
  )
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  await waitFor(() =>
    expect(
      screen.queryByText(/exécution de cette activité est suspendue/i),
    ).not.toBeInTheDocument(),
  )
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/amendments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cancellation',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 5,
        expected_approved_revision_id: 'revision-1',
        reason: 'Retour au socle.',
      }),
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Retirer l’activité' }))
  await user.type(
    screen.getByLabelText('Motif du retrait *'),
    'Retrait justifié.',
  )
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/withdrawals',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expected_version: 6,
          expected_approved_revision_id: 'revision-1',
          reason: 'Retrait justifié.',
        }),
      }),
    ),
  )
  expect(await screen.findByText('Demande de retrait en cours')).toBeVisible()
  expect(screen.queryByText('Prochaine étape')).not.toBeInTheDocument()
  expect(
    router.options.context.queryClient.getQueryState(accessKey)?.isInvalidated,
  ).toBeUndefined()
  await user.click(
    screen.getByRole('button', { name: 'Annuler la demande de retrait' }),
  )
  await user.type(
    screen.getByLabelText('Motif de l’annulation *'),
    'Conserver l’activité.',
  )
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/withdrawals/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cancellation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expected_version: 7,
          expected_approved_revision_id: 'revision-1',
          reason: 'Conserver l’activité.',
          expected_revision_id: 'revision-withdrawal',
        }),
      }),
    ),
  )
  expect(
    screen.queryByText('Demande de retrait en cours'),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Transférer vers un autre PTA' }),
  )
  expect(screen.getByText('PTA source :').parentElement).toHaveTextContent(
    '2027',
  )
  expect(screen.getByText(/Budget approuvé inchangé/)).toBeVisible()
  expect(screen.getByText(/Les tâches et leurs montants/)).toBeVisible()
  await user.type(
    screen.getByLabelText('Motif du transfert *'),
    'Calendrier 2028.',
  )
  await user.click(
    screen.getByRole('button', { name: /Nouvelle date de début/ }),
  )
  fireEvent.change(screen.getByLabelText('Nouvelle date de début'), {
    target: { value: '2028-02-01' },
  })
  expect(screen.getByText('PTA cible :').parentElement).toHaveTextContent(
    '2028',
  )
  await user.click(screen.getByRole('button', { name: /Nouvelle date de fin/ }))
  fireEvent.change(screen.getByLabelText('Nouvelle date de fin'), {
    target: { value: '2028-08-31' },
  })
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/transfers',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expected_version: 8,
          expected_approved_revision_id: 'revision-1',
          reason: 'Calendrier 2028.',
          planned_start: '2028-02-01',
          planned_end: '2028-08-31',
          tasks: [
            {
              id: 'operation-1',
              planned_start: '2028-02-01',
              planned_end: '2028-05-01',
              subtasks: [],
            },
          ],
        }),
      }),
    ),
  )
  expect(await screen.findByText('Demande de transfert en cours')).toBeVisible()
  activity = { ...activity, state: 'returned_supervisor' }
  await act(async () => {
    router.options.context.queryClient.setQueryData(
      ['planning', 'agent', 'activity', 'activity-1'],
      activity,
    )
  })
  expect(screen.queryByText('Prochaine étape')).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Annuler la demande de transfert' }),
  )
  await user.type(
    screen.getByLabelText('Motif de l’annulation *'),
    'Maintenir 2027.',
  )
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/transfers/cccccccc-cccc-4ccc-8ccc-cccccccccccc/cancellation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expected_version: 9,
          expected_approved_revision_id: 'revision-1',
          reason: 'Maintenir 2027.',
          expected_revision_id: 'revision-transfer',
        }),
      }),
    ),
  )
  await user.click(screen.getByRole('link', { name: 'Pièces justificatives' }))
  await screen.findByText('preuve.png')
  previewStatus = 403
  await user.click(
    within(screen.getByText('preuve.png').closest('li')).getByRole('button', {
      name: 'Aperçu de preuve.png',
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Cette pièce n’est plus accessible.',
  )
  expect(
    screen.getByRole('heading', { name: 'Atelier approuvé' }),
  ).toBeVisible()
}, 10000)

function amendmentHistoryFetch({ failed = false, historyFailed = false } = {}) {
  const activity = {
    id: 'activity-1',
    pta_id: 'pta-1',
    project_id: 'project-1',
    reference: 'ACT-000001',
    name: 'Activité courante',
    description: 'Description courante',
    planned_start: '2027-01-10',
    planned_end: '2027-04-10',
    allocation: '100000',
    state: 'approved',
    version: 8,
    current_revision_id: 'revision-2',
    approved_revision_id: 'revision-2',
    approved_allocation: '100000',
    approved: null,
    candidate: null,
    amendment: null,
    execution_paused: false,
    tasks: [],
    correction: null,
    agent_ids: [],
    allowed_actions: ['read', 'open_amendment'],
  }
  return vi.fn((url) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.includes('/amendments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))
      return Promise.resolve(
        failed
          ? new Response(JSON.stringify({ detail: 'unavailable' }), {
              status: 503,
            })
          : new Response(
              JSON.stringify({
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                activity_id: 'activity-1',
                status: 'approved',
                reason: 'Ajustement approuvé',
                base_approved_revision_id: 'revision-1',
                opened_by_id: 'agent-1',
                opened_at: '2027-03-01T09:00:00Z',
                last_revision_id: 'revision-2',
                cancellation: null,
                candidate: {
                  name: 'Nouveau nom approuvé',
                  description: 'Version historique',
                  planned_start: '2027-01-10',
                  planned_end: '2027-04-10',
                  allocation: '100000',
                  tasks: [
                    {
                      id: 'operation-1',
                      type_id: 'type-1',
                      type_label: 'Formation figée',
                      name: 'Former',
                      allocation: '100000',
                      position: 1,
                    },
                  ],
                },
              }),
            ),
      )
    if (path.endsWith('/activities/activity-1'))
      return Promise.resolve(new Response(JSON.stringify(activity)))
    if (historyFailed && path.endsWith('/activities/activity-1/history'))
      return Promise.resolve(
        new Response(JSON.stringify({ code: 'service_unavailable' }), {
          status: 503,
        }),
      )
    return Promise.resolve(
      new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        }),
      ),
    )
  })
}

test('Activity History ignores obsolete amendment detail links', async () => {
  vi.stubGlobal('fetch', amendmentHistoryFetch())
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: [
            '/activities/activity-1?tab=history&amendment=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ],
        }),
      )}
    />,
  )
  expect(await screen.findByText('Aucun événement')).toBeVisible()
  expect(screen.queryByText('Modification approuvée')).not.toBeInTheDocument()
  expect(screen.queryByText('Nouveau nom approuvé')).not.toBeInTheDocument()
  expect(screen.queryByText(/agent-1/)).not.toBeInTheDocument()
})

test('an obsolete amendment detail failure does not block Activity History', async () => {
  vi.stubGlobal('fetch', amendmentHistoryFetch({ failed: true }))
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: [
            '/activities/activity-1?tab=history&amendment=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ],
        }),
      )}
    />,
  )
  expect(await screen.findByText('Aucun événement')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a failed Activity History request does not also show the empty state', async () => {
  vi.stubGlobal('fetch', amendmentHistoryFetch({ historyFailed: true }))
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: ['/activities/activity-1?tab=history'],
        }),
      )}
    />,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Les données de planification sont indisponibles.',
  )
  expect(screen.queryByText('Aucun événement')).not.toBeInTheDocument()
})

test('an edited Activity retains its draft version after a background refresh', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  const initial = {
    version: 1,
    name: 'Activité initiale',
    description: 'Description',
    planned_start: '2027-01-01',
    planned_end: '2027-04-01',
    allocation: '100',
    tasks: [
      {
        id: 'operation-1',
        type_id: 'type-1',
        name: 'Atelier',
        allocation: '100',
      },
    ],
  }
  const props = {
    types: [{ id: 'type-1', label: 'Atelier' }],
    pending: false,
    onSubmit: submit,
  }
  const { rerender } = render(<ActivityForm {...props} initial={initial} />)
  await user.type(
    screen.getByLabelText('Intitulé de l’activité', { exact: true }),
    ' modifiée',
  )
  rerender(
    <ActivityForm
      {...props}
      initial={{
        ...initial,
        version: 2,
        planned_end: '2027-05-01',
        tasks: [{ ...initial.tasks[0], allocation: '200' }],
      }}
    />,
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({
      expected_version: 1,
      name: 'Activité initiale modifiée',
      allocation: '100',
      planned_end: '2027-04-01',
    }),
    'draft',
  )
})

test('an edited Activity keeps its manual amount while Task totals change', async () => {
  const user = userEvent.setup()
  render(
    <ActivityForm
      initial={{
        version: 1,
        name: 'Activité initiale',
        description: 'Description',
        planned_start: '2027-01-01',
        planned_end: '2027-04-01',
        allocation: '100',
        tasks: [
          {
            id: 'operation-1',
            type_id: 'type-1',
            name: 'Atelier',
            allocation: '100',
          },
        ],
      }}
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onSubmit={vi.fn()}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Modifier' }))
  const operationAmount = screen.getByLabelText('Montant prévu de la tâche')
  await user.clear(operationAmount)
  await user.type(operationAmount, '80')
  await user.click(screen.getByRole('button', { name: 'Enregistrer la tâche' }))
  expect(screen.getByRole('complementary')).toHaveTextContent('20 F CFA')
  expect(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  ).toBeEnabled()
  const plannedAmount = screen.getByLabelText(
    'Montant prévu de l’activité (F CFA)',
  )
  await user.clear(plannedAmount)
  await user.type(plannedAmount, '80')
  expect(screen.getByRole('complementary')).toHaveTextContent('0 F CFA')
  expect(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  ).toBeEnabled()
})

test('a cleared Activity amount remains empty in the saved Draft', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <ActivityForm
      initial={{
        version: 1,
        name: 'Activité initiale',
        description: 'Description',
        planned_start: '2027-01-01',
        planned_end: '2027-04-01',
        allocation: '100',
        tasks: [
          {
            id: 'task-1',
            type_id: 'type-1',
            name: 'Atelier',
            allocation: '100',
          },
        ],
      }}
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onSubmit={submit}
    />,
  )
  await user.clear(screen.getByLabelText('Montant prévu de l’activité (F CFA)'))
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({ allocation: null }),
    'draft',
  )
})

test('an Agent can clear an obsolete draft budget after removing its Operations', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <ActivityForm
      initial={{
        version: 1,
        name: 'Brouillon à reprendre',
        description: '',
        planned_start: null,
        planned_end: null,
        allocation: '100',
        tasks: [],
      }}
      types={[]}
      pending={false}
      onSubmit={submit}
    />,
  )
  await user.clear(screen.getByLabelText('Montant prévu de l’activité (F CFA)'))
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({ allocation: null, tasks: [] }),
    'draft',
  )
})

test('subtasks start blank and keep manually entered totals', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  render(
    <ActivityForm
      initial={{
        version: 1,
        state: 'draft',
        name: 'Répartition',
        description: '',
        planned_start: null,
        planned_end: null,
        allocation: '100',
        tasks: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            type_id: 'type-1',
            name: 'Préparer',
            description: '',
            allocation: '100',
            weight: '',
            planned_start: '',
            planned_end: '',
            subtasks: [],
          },
        ],
      }}
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onSubmit={vi.fn()}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Modifier' }))
  const add = screen.getByRole('button', { name: 'Ajouter une sous-tâche' })
  await user.click(add)
  const first = screen.getByLabelText('Montant prévu de la sous-tâche')
  expect(first).toHaveValue('')
  expect(screen.getByLabelText('Pondération de la sous-tâche (%)')).toHaveValue(
    '',
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer la sous-tâche' }),
  )
  expect(
    within(screen.getByRole('dialog')).getByLabelText('Intitulé'),
  ).toHaveAttribute('data-value-missing', 'true')
  expect(first).toHaveAttribute('data-value-missing', 'true')
  await user.type(
    within(screen.getByRole('dialog')).getByLabelText('Intitulé'),
    'Salle',
  )
  await user.type(first, '60')
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer la sous-tâche' }),
  )
  expect(screen.getByText(/60 F CFA \/ 100 F CFA/)).toBeVisible()
})

test('a returned correction can save incomplete dates and weights', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <ActivityForm
      year={2027}
      initial={{
        version: 3,
        state: 'returned_supervisor',
        name: 'Correction à compléter',
        description: '',
        planned_start: null,
        planned_end: null,
        allocation: '100',
        tasks: [
          {
            id: 'operation-1',
            type_id: 'type-1',
            name: 'Atelier',
            allocation: '100',
          },
        ],
      }}
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onSubmit={submit}
    />,
  )
  expect(screen.getByLabelText('Description')).not.toBeRequired()
  expect(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  ).toBeEnabled()
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )
  expect(submit).toHaveBeenCalledWith(expect.any(Object), 'draft')
})

test('assignment edits retain their base version and can discard a stale draft', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  let activity = {
    id: 'assignment-1',
    project_id: 'project-1',
    reference: 'ACT-1',
    name: 'Coordination',
    state: 'draft',
    version: 1,
    planned_start: '2027-01-01',
    planned_end: null,
    allocation: '100',
    tasks: [
      {
        id: 'task-1',
        name: 'Préparation saisie',
        allocation: '100',
        weight: null,
        planned_start: null,
        planned_end: null,
        subtasks: [],
      },
    ],
    agent_ids: [],
    agents: [],
    creator: {
      id: 'supervisor',
      email: 'supervisor@example.test',
      full_name: 'Sali Superviseure',
    },
    latest_decision_actor: null,
    allowed_actions: ['read', 'assign_agents'],
  }
  let assigned
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = String(url)
      if (options.method === 'PUT') {
        assigned = JSON.parse(options.body)
        return new Response(JSON.stringify({ code: 'activity_stale' }), {
          status: 409,
        })
      }
      let body = {
        object: 'list',
        count: 0,
        data: [],
        next: null,
        previous: null,
      }
      if (path.includes('/auth/session'))
        body = {
          state: 'verified',
          csrf: 'csrf',
          user: {
            id: 'supervisor',
            email: 'user@example.test',
            role: 'AGENT_VERIFICATEUR',
          },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        }
      else if (path.endsWith('/activities/assignment-1')) body = activity
      else if (path.includes('/assignment-agents'))
        body = {
          ...body,
          count: path.includes('q=nobody') ? 0 : 1,
          data: path.includes('q=nobody')
            ? []
            : [{ id: 'agent-1', email: 'agent@example.test' }],
        }
      return new Response(JSON.stringify(body))
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/activities/assignment-1'] }),
  )
  render(<App router={router} />)
  await screen.findByRole('heading', { name: 'Coordination' })
  expect(screen.getByText(/Tâches et budget à compléter\./)).toBeVisible()
  expect(
    screen.queryByText(/Brief créé par Sali Superviseure\./),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Tâches' })).toBeVisible()
  expect(screen.getByText('Préparation saisie')).toBeVisible()
  expect(screen.getAllByText('Montant prévu')).not.toHaveLength(0)
  expect(screen.getAllByText('100 F CFA')).not.toHaveLength(0)
  activity = { ...activity, planned_end: '2027-04-01' }
  await act(async () => {
    await router.options.context.queryClient.invalidateQueries({
      queryKey: ['planning', 'supervisor', 'activity', 'assignment-1'],
    })
  })
  expect(screen.getByText(/Tâches et budget à compléter\./)).toBeVisible()
  expect(
    fetch.mock.calls.some(([url]) => String(url).includes('/history')),
  ).toBe(false)
  expect(
    fetch.mock.calls.some(([url]) => String(url).includes('/documents')),
  ).toBe(false)
  expect(
    fetch.mock.calls.some(([url]) => String(url).includes('/revisions/')),
  ).toBe(false)
  const editOwners = await screen.findByRole('button', {
    name: 'Affectations',
  })
  expect(editOwners).toHaveTextContent('Affectations')
  expect(editOwners).toHaveClass('rounded-card')
  expect(editOwners.querySelector('svg')).toBeNull()
  await user.click(editOwners)
  await user.click(
    screen.getByRole('button', { name: 'Rechercher et ajouter un Agent' }),
  )
  await user.click(
    await screen.findByRole('option', { name: 'agent@example.test' }),
  )
  await user.type(
    screen.getByRole('searchbox', {
      name: 'Rechercher et ajouter un Agent',
    }),
    'nobody',
  )
  await screen.findByText('Aucun Agent ne correspond à votre recherche.')
  expect(screen.getByText('agent@example.test')).toBeVisible()
  await act(async () => {
    router.options.context.queryClient.setQueryData(
      ['planning', 'supervisor', 'activity', 'assignment-1'],
      { ...activity, version: 2 },
    )
  })
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer les affectations' }),
  )
  await waitFor(() =>
    expect(assigned).toEqual({ expected_version: 1, agent_ids: ['agent-1'] }),
  )
  await user.click(screen.getByRole('button', { name: 'Annuler' }))
  expect(
    screen.queryByRole('dialog', { name: 'Responsables de l’activité' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Affectations' }))
  expect(
    screen.queryByRole('button', { name: 'Retirer agent@example.test' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Enregistrer les affectations' }),
  ).toBeDisabled()
})

test.each([['is unavailable', false]])(
  'a decision attachment %s in the prevalidation modal',
  async (_case, recovered) => {
    const user = userEvent.setup()
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
    let decisionCalls = 0
    let uploadCalls = 0
    let activity = {
      id: 'review-1',
      pta_id: 'pta-1',
      project_id: 'project-1',
      project_name: 'Justice locale',
      partner_name: 'Partenaire public',
      pta_name: 'PTA 2027',
      reference: 'ACT-1',
      name: 'Coordination',
      description: 'Préparation',
      state: 'submitted',
      version: 2,
      planned_start: '2027-01-01',
      planned_end: '2027-04-01',
      placement_year: 2027,
      allocation: '100',
      tasks: [],
      agent_ids: ['agent-1'],
      agents: [
        {
          id: 'agent-1',
          email: 'agent@example.test',
          full_name: 'Aïcha Agent',
        },
      ],
      current_revision_id: 'revision-1',
      current_revision_number: 1,
      current_submitter: {
        id: 'agent-1',
        email: 'agent@example.test',
        full_name: 'Aïcha Agent',
      },
      approved_revision_id: null,
      approved_allocation: null,
      correction: null,
      amendment: null,
      withdrawal: null,
      transfer: null,
      execution_paused: false,
      allowed_actions: ['read', 'prevalidate', 'assign_agents'],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        const path = String(url)
        if (path.includes('/auth/session'))
          return new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: {
                id: 'supervisor',
                email: 'supervisor@example.test',
                role: 'AGENT_VERIFICATEUR',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          )
        if (
          path.endsWith('/revisions/revision-1/decisions') &&
          options.method === 'POST'
        ) {
          decisionCalls += 1
          activity = {
            ...activity,
            state: 'prevalidated',
            version: 3,
            allowed_actions: ['read', 'assign_agents'],
          }
          return new Response(
            JSON.stringify({
              id: 'decision-1',
              activity_version: 3,
              reason: 'Programmation vérifiée.',
            }),
            { status: 201 },
          )
        }
        if (
          path.endsWith('/activities/review-1/documents') &&
          options.method === 'POST'
        ) {
          uploadCalls += 1
          if (uploadCalls === 1) {
            if (recovered) throw new TypeError('lost response')
            return new Response(
              JSON.stringify({ code: 'service_unavailable' }),
              {
                status: 503,
              },
            )
          }
          return new Response(JSON.stringify({ id: 'document-1' }), {
            status: 201,
          })
        }
        if (path.endsWith('/activities/review-1/documents?limit=60')) {
          const collision = {
            id: 'existing-document',
            name: 'note.pdf',
            size: 8,
            uploaded_by_id: 'supervisor',
            uploaded_at: '2099-01-01T00:00:00Z',
          }
          const uploaded = {
            id: 'document-1',
            name: 'note.pdf',
            size: 8,
            uploaded_by_id: 'supervisor',
            uploaded_at: '2001-01-01T00:00:00Z',
          }
          const data =
            recovered && uploadCalls > 0 ? [collision, uploaded] : [collision]
          return new Response(
            JSON.stringify({
              object: 'list',
              count: data.length,
              data,
              next: null,
              previous: null,
            }),
          )
        }
        if (path.endsWith('/activities/review-1'))
          return new Response(JSON.stringify(activity))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        )
      }),
    )
    const router = makeRouter(
      createMemoryHistory({ initialEntries: ['/activities/review-1'] }),
    )
    const notificationKey = ['notifications', 'supervisor', 'all', '', 60]
    const ptaSummaryKey = ['planning', 'supervisor', 'pta', 'project-1', 2027]
    render(<App router={router} />)
    const prevalidate = await screen.findByRole('button', {
      name: 'Prévalider',
    })
    expect(screen.getByText('À prévalider')).toBeVisible()
    const purpose = screen.getByText('Objet de l’activité').parentElement
    expect(purpose).toBeVisible()
    expect(within(purpose).getByText('Préparation')).toBeVisible()
    expect(screen.queryByText('Prochaine étape')).not.toBeInTheDocument()
    router.options.context.queryClient.setQueryData(notificationKey, {
      object: 'list',
      count: 1,
      data: [{ id: 'notice-1', handled_at: null }],
      next: null,
      previous: null,
    })
    router.options.context.queryClient.setQueryData(ptaSummaryKey, {
      summary: { review: 1 },
    })
    await user.click(prevalidate)
    await user.type(
      screen.getByLabelText('Observation'),
      'Programmation vérifiée.',
    )
    expect(
      screen.queryByLabelText('Pièce justificative'),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Prévalider et transmettre' }),
    )
    await waitFor(() => expect(decisionCalls).toBe(1))
    await waitFor(() =>
      expect(
        router.options.context.queryClient.getQueryState(ptaSummaryKey)
          ?.isInvalidated,
      ).toBe(true),
    )
    await waitFor(() =>
      expect(
        router.options.context.queryClient.getQueryState(notificationKey)
          ?.isInvalidated,
      ).toBe(true),
    )
    expect(uploadCalls).toBe(0)
    expect(decisionCalls).toBe(1)
    expect(await screen.findByText('À valider définitivement')).toBeVisible()
  },
)

test('a new Activity keeps its request key across a lost-response retry', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <ActivityForm
      year={2027}
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onSubmit={submit}
    />,
  )
  await user.type(
    screen.getByLabelText('Intitulé de l’activité', { exact: true }),
    'Activité',
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )
  expect(submit).toHaveBeenCalledTimes(2)
  expect(submit.mock.calls[0][0].request_key).toBe(
    submit.mock.calls[1][0].request_key,
  )
})

test.each([
  ['new', undefined],
  [
    'existing',
    {
      id: 'activity-1',
      version: 1,
      name: 'Activité existante',
      description: '',
      planned_start: null,
      planned_end: null,
      allocation: null,
      tasks: [],
    },
  ],
])(
  'the %s Activity Task breadcrumb returns to its Activity Draft',
  async (_case, initial) => {
    const user = userEvent.setup()
    render(
      <ActivityForm
        year={2027}
        projectId="project-1"
        initial={initial}
        types={[]}
        pending={false}
        onSubmit={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Ajouter une tâche' }))
    await user.click(screen.getByRole('link', { name: /activité/i }))

    expect(
      screen.getByRole('heading', { name: 'Informations générales' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Ajouter une tâche' }),
    ).not.toBeInTheDocument()
  },
)

test('Draft validation reports entered Task and Subtask bounds before saving', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <ActivityForm
      year={2027}
      types={[{ id: 'category-1', label: 'Formation' }]}
      initial={{
        id: 'activity-1',
        version: 1,
        name: 'Activité bornée',
        description: '',
        planned_start: '2027-02-01',
        planned_end: '2027-02-28',
        allocation: '100',
        tasks: [
          {
            id: 'task-1',
            type_id: 'category-1',
            name: 'Préparation',
            description: '',
            allocation: '100',
            weight: '101',
            planned_start: '2027-01-31',
            planned_end: '2027-02-28',
            subtasks: [
              {
                id: 'subtask-1',
                name: 'Supports',
                description: '',
                allocation: '100',
                weight: '101',
                planned_start: '2027-02-01',
                planned_end: '2027-03-01',
              },
            ],
          },
        ],
      }}
      pending={false}
      onSubmit={submit}
    />,
  )

  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )

  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent(
    'Tâche 1 « Préparation » : la pondération saisie doit être comprise entre 0 et 100 %',
  )
  expect(alert).toHaveTextContent(
    'Tâche 1 « Préparation » : les dates doivent rester dans la période de l’activité.',
  )
  expect(alert).toHaveTextContent(
    'sous-tâche 1 « Supports » : la pondération saisie doit être comprise entre 0 et 100 %',
  )
  expect(alert).toHaveTextContent(
    'sous-tâche 1 « Supports » : les dates doivent rester dans la période de la tâche.',
  )
  expect(submit).not.toHaveBeenCalled()
})

test('a Task creates and selects a Category from the Category control', async () => {
  const createType = vi
    .fn()
    .mockResolvedValue({ id: 'type-new', label: 'Logistique' })
  const user = userEvent.setup()
  render(
    <ActivityForm
      year={2027}
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onCreateType={createType}
      onSubmit={vi.fn()}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Ajouter une tâche' }))
  await selectOption(screen.getByLabelText('Catégorie'), 'Créer une catégorie')
  const dialog = screen.getByRole('dialog', { name: 'Créer une catégorie' })
  await user.type(within(dialog).getByLabelText('Nom *'), 'Logistique')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
  expect(createType).toHaveBeenCalledWith({
    label: 'Logistique',
    description: null,
  })
  expect(screen.getByLabelText('Catégorie')).toHaveTextContent('Logistique')
})

test('reopening Category creation from a Task clears a previous request error', async () => {
  const createType = vi
    .fn()
    .mockRejectedValue(new Error('Service indisponible'))
  const user = userEvent.setup()
  render(
    <ActivityForm
      year={2027}
      types={[]}
      pending={false}
      onCreateType={createType}
      onSubmit={vi.fn()}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Ajouter une tâche' }))
  await selectOption(screen.getByLabelText('Catégorie'), 'Créer une catégorie')
  let dialog = screen.getByRole('dialog', { name: 'Créer une catégorie' })
  await user.type(within(dialog).getByLabelText('Nom *'), 'Logistique')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Service indisponible',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))
  await selectOption(screen.getByLabelText('Catégorie'), 'Créer une catégorie')
  dialog = screen.getByRole('dialog', { name: 'Créer une catégorie' })
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
})

test('an Agent sees the empty planning workspace', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('/auth/')
              ? {
                  state: 'verified',
                  csrf: 'fixture',
                  user: {
                    id: 'agent',
                    email: 'agent@example.test',
                    role: 'AGENT_SAISIE',
                  },
                  expires_at: new Date(Date.now() + 60000).toISOString(),
                }
              : {
                  object: 'list',
                  count: 0,
                  data: [],
                  next: null,
                  previous: null,
                },
          ),
        ),
      ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/planning'] }),
      )}
    />,
  )
  await screen.findByText('Aucun PTA')
  expect(
    screen.getByRole('heading', { name: 'Prévisions (PTA)', level: 1 }),
  ).toBeVisible()
  expect(screen.getByText('Aucun PTA')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Créer un projet' }),
  ).not.toBeInTheDocument()
})

test.each(['ADMIN_PLATEFORME', 'PARTENAIRE'])(
  '%s cannot see planning records',
  async (role) => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'fixture',
            user: {
              id: 'admin',
              email: 'user@example.test',
              role,
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      ),
    )
    vi.stubGlobal('fetch', fetch)
    render(
      <App
        router={makeRouter(
          createMemoryHistory({ initialEntries: ['/projects'] }),
        )}
      />,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé')
    expect(
      screen.getByRole('link', { name: 'Retour à mon espace' }),
    ).toBeVisible()
    expect(fetch.mock.calls.every(([url]) => url.includes('/auth/'))).toBe(true)
  },
)

test('Validator creation uses a modal dialog and returns focus on Escape', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('/auth/')
              ? {
                  state: 'verified',
                  csrf: 'fixture',
                  user: {
                    id: 'validator',
                    email: 'user@example.test',
                    role: 'VALIDATEUR_DEFINITIF',
                  },
                  expires_at: new Date(Date.now() + 60000).toISOString(),
                }
              : {
                  object: 'list',
                  count: 0,
                  data: [],
                  next: null,
                  previous: null,
                },
          ),
        ),
      ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/partners'] }),
      )}
    />,
  )
  const heading = await screen.findByRole('heading', {
    name: 'Partenaires',
    level: 1,
  })
  const opener = within(
    heading.closest('[data-ui~="planning-card"]'),
  ).getByRole('button', {
    name: 'Créer un partenaire',
  })
  await user.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Créer un partenaire' })
  expect(dialog).toHaveAttribute('open')
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(dialog).not.toHaveAttribute('open')
  expect(opener).toHaveFocus()
})

test('authentication loss aborts an in-flight planning mutation and masks it', async () => {
  const user = userEvent.setup()
  let mutationSignal
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options = {}) => {
      if (url.includes('/auth/'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: {
                id: 'validator',
                email: 'user@example.test',
                role: 'VALIDATEUR_DEFINITIF',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (options.method === 'POST') {
        mutationSignal = options.signal
        return new Promise((_resolve, reject) =>
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        )
      }
      const data = url.endsWith('/partners')
        ? [
            {
              id: 'partner-1',
              name: 'Partenaire',
              active: true,
              allowed_actions: [],
            },
          ]
        : []
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: data.length,
            data,
            next: null,
            previous: null,
          }),
        ),
      )
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/projects'] }),
      )}
    />,
  )
  const opener = await screen.findByRole('button', { name: 'Créer un projet' })
  await waitFor(() => expect(opener).toBeEnabled())
  await user.click(opener)
  await user.type(screen.getByLabelText('Nom *'), 'Projet retardé')
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Enregistrer',
      exact: true,
    }),
  )
  window.dispatchEvent(new Event('offline'))
  expect(
    await screen.findByRole('heading', { name: 'Connexion indisponible' }),
  ).toBeVisible()
  expect(mutationSignal.aborted).toBe(true)
  expect(
    screen.queryByText('Modifications enregistrées.'),
  ).not.toBeInTheDocument()
})

test('a planning mutation invalidates and visibly refreshes the cached list', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  let partnerReads = 0
  let created = false
  const requestUrls = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options = {}) => {
      requestUrls.push(String(url))
      if (url.includes('/auth/'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: {
                id: 'validator',
                email: 'user@example.test',
                role: 'VALIDATEUR_DEFINITIF',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (
        String(url).includes('/api/v1/partners') &&
        options.method === 'POST'
      ) {
        created = true
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'partner-1' }), { status: 201 }),
        )
      }
      let data = []
      if (String(url).includes('/api/v1/partners')) {
        partnerReads += 1
        if (created)
          data = [
            {
              id: 'partner-1',
              name: 'Partenaire actualisé',
              active: true,
              allowed_actions: ['read'],
            },
          ]
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: data.length,
            data,
            next: null,
            previous: null,
          }),
        ),
      )
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/partners'] }),
      )}
    />,
  )
  const heading = await screen.findByRole('heading', {
    name: 'Partenaires',
    level: 1,
  })
  expect(requestUrls.join('|')).toContain('/api/v1/partners')
  const card = heading.closest('[data-ui~="planning-card"]')
  await user.click(
    within(card).getByRole('button', { name: 'Créer un partenaire' }),
  )
  const dialog = within(card).getByRole('dialog')
  await user.type(
    within(dialog).getByLabelText('Nom *'),
    'Partenaire actualisé',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(partnerReads).toBeGreaterThanOrEqual(2))
  expect(await within(card).findByText('Partenaire actualisé')).toBeVisible()
})

test('a 409 planning mutation refetches server state before another action', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  let partnerReads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options = {}) => {
      if (url.includes('/auth/'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: {
                id: 'validator',
                email: 'user@example.test',
                role: 'VALIDATEUR_DEFINITIF',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (options.method === 'POST')
        return Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'activity_stale',
              message: 'Version obsolète.',
            }),
            { status: 409 },
          ),
        )
      if (String(url).includes('/api/v1/partners')) partnerReads += 1
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/partners'] }),
      )}
    />,
  )
  const heading = await screen.findByRole('heading', {
    name: 'Partenaires',
    level: 1,
  })
  const card = heading.closest('[data-ui~="planning-card"]')
  await user.click(
    within(card).getByRole('button', { name: 'Créer un partenaire' }),
  )
  const dialog = within(card).getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom *'), 'Conflit')
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(partnerReads).toBeGreaterThanOrEqual(2))
  expect(screen.getByRole('alert')).toBeVisible()
})

test('a delayed planning result cannot repopulate content after access denial', async () => {
  let releasePartners
  let reportPartnerRequest
  const partnerRequested = new Promise((resolve) => {
    reportPartnerRequest = resolve
  })
  const delayedPartners = new Promise((resolve) => {
    releasePartners = resolve
  })
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (url.includes('/auth/'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: {
                id: 'agent',
                email: 'user@example.test',
                role: 'VALIDATEUR_DEFINITIF',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (String(url).includes('/api/v1/partners')) {
        reportPartnerRequest()
        return delayedPartners
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partners'] }),
  )
  expect(router.state.location.pathname).toBe('/partners')
  render(<App router={router} />)
  await partnerRequested
  await screen.findByRole('status', { name: 'Chargement : Partenaires' })
  await waitFor(() =>
    expect(
      document.querySelector('[data-access-protected]'),
    ).toBeInTheDocument(),
  )
  act(() => router.options.context.access.offline())
  expect(
    await screen.findByRole('heading', { name: 'Connexion indisponible' }),
  ).toBeVisible()
  await act(async () => {
    releasePartners(
      new Response(
        JSON.stringify({
          object: 'list',
          count: 1,
          data: [
            {
              id: 'secret',
              name: 'Partenaire retardé',
              active: true,
              allowed_actions: [],
            },
          ],
          next: null,
          previous: null,
        }),
      ),
    )
  })
  await waitFor(() =>
    expect(screen.queryByText('Partenaire retardé')).not.toBeInTheDocument(),
  )
})

test.each(['success', 'failure'])(
  'an uncertain workflow response stays blocked through %s reconciliation',
  async (refetchOutcome) => {
    const user = userEvent.setup()
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
    let committed = false
    let activityReads = 0
    let submissionCalls = 0
    let resolveActivityRefetch
    const activityRefetch = new Promise((resolve) => {
      resolveActivityRefetch = resolve
    })
    const draft = {
      id: 'activity-uncertain',
      pta_id: 'pta-1',
      project_id: 'project-1',
      reference: 'ACT-000099',
      name: 'Activité à réconcilier',
      description: 'Réponse réseau perdue',
      planned_start: '2027-01-10',
      planned_end: '2027-04-10',
      allocation: '100000',
      state: 'draft',
      version: 1,
      current_revision_id: null,
      approved_revision_id: null,
      approved_allocation: null,
      tasks: [
        {
          id: 'operation-1',
          type_id: 'type-1',
          name: 'Préparer',
          allocation: '100000',
          weight: '100',
          planned_start: '2027-01-10',
          planned_end: '2027-04-10',
          position: 1,
          subtasks: [],
        },
      ],
      agent_ids: [],
      allowed_actions: ['read', 'edit', 'submit'],
    }
    const revision = {
      id: 'revision-uncertain',
      revision_number: 1,
      activity_version: 2,
      submitted_at: '2027-01-02T10:00:00Z',
      decisions: [],
    }
    const fetch = vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: {
                id: 'agent',
                email: 'user@example.test',
                role: 'AGENT_SAISIE',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/activities/activity-next'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...draft,
              id: 'activity-next',
              name: 'Activité suivante',
            }),
          ),
        )
      if (path.endsWith('/activities/activity-uncertain/submissions')) {
        submissionCalls += 1
        committed = true
        return Promise.reject(new TypeError('lost response'))
      }
      if (path.endsWith('/activities/activity-uncertain')) {
        activityReads += 1
        if (committed) return activityRefetch
        return Promise.resolve(new Response(JSON.stringify(draft)))
      }
      if (path.endsWith(`/revisions/${revision.id}`))
        return Promise.resolve(new Response(JSON.stringify(revision)))
      if (path.includes('/activities/activity-uncertain/revisions'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: committed ? 1 : 0,
              data: committed ? [revision] : [],
              next: null,
              previous: null,
            }),
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)
    const router = makeRouter(
      createMemoryHistory({
        initialEntries: ['/activities/activity-uncertain'],
      }),
    )
    render(<App router={router} />)
    await user.click(
      await screen.findByRole('button', {
        name: 'Soumettre pour prévalidation',
      }),
    )
    await user.click(
      screen.getByRole('dialog').querySelector('button[type="submit"]'),
    )
    await waitFor(() => expect(submissionCalls).toBe(1))
    expect(
      screen.getByRole('button', { name: 'Soumettre pour prévalidation' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('dialog').querySelector('button[type="submit"]'),
    ).toBeDisabled()
    await act(async () => {
      resolveActivityRefetch(
        refetchOutcome === 'success'
          ? new Response(
              JSON.stringify({
                ...draft,
                state: 'submitted',
                version: 2,
                current_revision_id: revision.id,
                allowed_actions: ['read'],
              }),
            )
          : new Response(JSON.stringify({ code: 'service_unavailable' }), {
              status: 503,
            }),
      )
    })
    expect(activityReads).toBeGreaterThanOrEqual(2)
    expect(submissionCalls).toBe(1)
    if (refetchOutcome === 'success') {
      expect((await screen.findAllByText('À prévalider'))[0]).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'Soumettre pour prévalidation' }),
      ).not.toBeInTheDocument()
    } else {
      expect(
        await screen.findByText(
          'Les données de planification sont indisponibles.',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('button', { name: 'Soumettre pour prévalidation' }),
      ).toBeDisabled()
    }
    await act(async () => {
      await router.navigate({
        to: '/activities/$activityId',
        params: { activityId: 'activity-next' },
      })
    })
    expect(
      await screen.findByRole('button', {
        name: 'Soumettre pour prévalidation',
      }),
    ).toBeEnabled()
  },
)

test('projects check Partner availability before enabling creation', async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  const fetch = vi.fn(async (url) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return new Response(
        JSON.stringify({
          state: 'verified',
          csrf: 'test',
          user: {
            id: 'validator',
            email: 'validator@example.test',
            role: 'VALIDATEUR_DEFINITIF',
          },
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      )
    if (path.includes('/projects') || path.includes('/partners'))
      return new Response(
        JSON.stringify({ data: [], count: 0, next: null, previous: null }),
      )
    return new Response(
      JSON.stringify({ code: 'unexpected', message: 'Unexpected request' }),
      { status: 503 },
    )
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/projects'] }),
      )}
    />,
  )
  expect(await screen.findByText('Aucun projet')).toBeVisible()
  await waitFor(() =>
    expect(
      fetch.mock.calls.map(
        ([url]) => new URL(url, 'http://localhost').pathname,
      ),
    ).toContain('/api/v1/partners'),
  )
  expect(
    screen.getByRole('button', { name: 'Créer un projet', exact: true }),
  ).toBeDisabled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

function renderProjectsForClosure({ failCloseOnce = false } = {}) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
  let project = {
    id: 'project-1',
    name: 'Projet initial',
    reference: 'PRJ-001',
    partner_name: 'Partenaire',
    state: 'active',
    version: 1,
    allowed_actions: ['edit', 'close'],
  }
  const update = vi.fn()
  let closeAttempts = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = new URL(url, window.location.origin).pathname
      if (path.endsWith('/auth/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'validator',
              email: 'validator@example.test',
              role: 'VALIDATEUR_DEFINITIF',
            },
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        )
      if (path.endsWith('/partners'))
        return new Response(
          JSON.stringify({
            data: [{ id: 'partner-1', name: 'Partenaire', active: true }],
            count: 1,
            next: null,
            previous: null,
          }),
        )
      if (path === '/api/v1/projects/project-1') {
        const body = JSON.parse(options.body)
        update(body)
        closeAttempts += 1
        if (failCloseOnce && closeAttempts === 1)
          return new Response(
            JSON.stringify({ message: 'Clôture indisponible.' }),
            { status: 503 },
          )
        project = {
          ...project,
          state: 'closed',
          version: project.version + 1,
          allowed_actions: [],
        }
        return new Response(JSON.stringify(project))
      }
      if (path.endsWith('/projects'))
        return new Response(
          JSON.stringify({
            data: [project],
            count: 1,
            next: null,
            previous: null,
          }),
        )
      return new Response('{}', { status: 404 })
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/projects'] }),
  )
  render(<App router={router} />)
  const replaceProjects = (data) => {
    project = data[0] || project
    const [entry] = router.options.context.queryClient.getQueriesData({
      queryKey: ['planning', 'validator', 'projects'],
    })
    act(() => {
      router.options.context.queryClient.setQueryData(entry[0], {
        data,
        count: data.length,
        next: null,
        previous: null,
      })
    })
  }
  return { router, update, replaceProjects, project: () => project }
}

test('Project closure follows the current Query row and submits its version', async () => {
  const user = userEvent.setup()
  const { update, replaceProjects, project } = renderProjectsForClosure()
  await user.click(await screen.findByRole('button', { name: 'Clôturer' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Projet initial')

  replaceProjects([{ ...project(), name: 'Projet actualisé', version: 2 }])
  await waitFor(() =>
    expect(screen.getByRole('dialog')).toHaveTextContent('Projet actualisé'),
  )

  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Clôturer',
    }),
  )
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({
      action: 'close',
      expected_version: 2,
    }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(await screen.findByText('Clôturé')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Clôturer' }),
  ).not.toBeInTheDocument()
})

test('failed Project closure stays visible with its error and can be retried', async () => {
  const user = userEvent.setup()
  const { update } = renderProjectsForClosure({ failCloseOnce: true })
  await user.click(await screen.findByRole('button', { name: 'Clôturer' }))
  const dialog = screen.getByRole('dialog')

  await user.click(within(dialog).getByRole('button', { name: 'Clôturer' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Service indisponible. Réessayez plus tard.',
  )
  expect(dialog).toBeInTheDocument()

  await user.click(within(dialog).getByRole('button', { name: 'Clôturer' }))
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(await screen.findByText('Clôturé')).toBeVisible()
})

test('removing the Project being closed returns focus to the Projects heading', async () => {
  const user = userEvent.setup()
  const { replaceProjects } = renderProjectsForClosure()
  const heading = await screen.findByRole('heading', {
    name: 'Projets',
    level: 1,
  })
  await user.click(screen.getByRole('button', { name: 'Clôturer' }))

  replaceProjects([])

  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(heading).toHaveFocus())
})

test('new activity loads its context and operation choices without fetching activity lists', async () => {
  const fetch = annualPageFetch()
  vi.stubGlobal('fetch', fetch)
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/projects/project-1/ptas/2027'] }),
  )
  render(<App router={router} />)
  await screen.findByRole('region', { name: 'Synthèse du PTA' })
  const activityRequests = () =>
    fetch.mock.calls
      .map(([url]) => new URL(url, 'http://localhost'))
      .filter((url) => url.pathname === '/api/v1/ptas/pta-1/activities')
  expect(activityRequests().some((url) => !url.searchParams.has('agent'))).toBe(
    true,
  )
  const boundary = fetch.mock.calls.length
  await act(async () => {
    await router.navigate({
      to: '/projects/$projectId/ptas/$year/activities/new',
      params: { projectId: 'project-1', year: '2027' },
    })
  })
  await screen.findByRole('heading', { name: 'Informations générales' })
  const newPaths = fetch.mock.calls
    .slice(boundary)
    .map(([url]) => new URL(url, 'http://localhost').pathname)
  expect(newPaths).toContain('/api/v1/task-categories')
  expect(newPaths.filter((path) => path.startsWith('/api/v1/ptas/'))).toEqual(
    [],
  )
})

test('a failed Category request does not block saving a new Activity Draft', async () => {
  const user = userEvent.setup()
  const base = annualPageFetch()
  const fetch = vi.fn(async (url, options = {}) => {
    const path = new URL(String(url), 'http://localhost').pathname
    if (path === '/api/v1/task-categories')
      return new Response(JSON.stringify({ code: 'service_unavailable' }), {
        status: 503,
      })
    if (
      path === '/api/v1/projects/project-1/ptas/2027/activities' &&
      options.method === 'POST'
    )
      return new Response(
        JSON.stringify({ id: 'saved-draft', version: 1, state: 'draft' }),
        { status: 201 },
      )
    return base(url, options)
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: ['/projects/project-1/ptas/2027/activities/new'],
        }),
      )}
    />,
  )

  expect(
    await screen.findByRole('heading', { name: 'Informations générales' }),
  ).toBeVisible()
  expect(
    screen.getByText('Les données de planification sont indisponibles.'),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Soumettre pour prévalidation' }),
  ).toBeDisabled()
  await user.type(
    screen.getByLabelText('Intitulé de l’activité', { exact: true }),
    'Brouillon sans catégorie',
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )

  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url, options]) => {
        const path = new URL(String(url), 'http://localhost').pathname
        return (
          path === '/api/v1/projects/project-1/ptas/2027/activities' &&
          options?.method === 'POST'
        )
      }),
    ).toBe(true),
  )
})

test('unavailable Categories still allow Draft saving but block submission', async () => {
  const user = userEvent.setup()
  const cancel = vi.fn()
  const submit = vi.fn()
  render(
    <ActivityForm
      types={[]}
      optionsUnavailable
      initial={{
        version: 1,
        name: 'Brouillon local',
        description: '',
        planned_start: null,
        planned_end: null,
        allocation: null,
        tasks: [],
      }}
      onCancel={cancel}
      onSubmit={submit}
    />,
  )
  expect(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  ).toBeEnabled()
  expect(
    screen.getByRole('button', { name: 'Soumettre pour prévalidation' }),
  ).toBeDisabled()
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({ tasks: [] }),
    'draft',
  )
  const button = screen.getByRole('button', { name: 'Annuler' })
  expect(button).toBeEnabled()
  await user.click(button)
  expect(cancel).toHaveBeenCalledOnce()
})

test('the Task editor can reach later Category pages', async () => {
  const user = userEvent.setup()
  const navigate = vi.fn()
  render(
    <ActivityForm
      year={2027}
      types={[{ id: 'category-1', label: 'Première page' }]}
      typeResult={{
        data: [{ id: 'category-1', label: 'Première page' }],
        previous: null,
        next: '/api/v1/task-categories?cursor=second-page',
      }}
      navigate={navigate}
      pending={false}
      onSubmit={vi.fn()}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Ajouter une tâche' }))
  await user.click(screen.getByRole('button', { name: 'Suivant' }))

  expect(navigate).toHaveBeenCalledOnce()
  const updateSearch = navigate.mock.calls[0][0].search
  expect(updateSearch({ q: 'formation' })).toEqual({
    q: 'formation',
    typeCursor: 'second-page',
  })
})

test('a failed background project refresh preserves the open draft and offers local retry', async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
  let failed = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (url.endsWith('/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'validator',
              email: 'validator@example.test',
              role: 'VALIDATEUR_DEFINITIF',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (url.endsWith('/partners'))
        return new Response(
          JSON.stringify({
            data: [{ id: 'partner', name: 'Partenaire', active: true }],
            count: 1,
            next: null,
            previous: null,
          }),
        )
      if (url.endsWith('/projects') && failed)
        return new Response('{}', { status: 503 })
      return new Response(
        JSON.stringify({ data: [], count: 0, next: null, previous: null }),
      )
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/projects'] }),
  )
  render(<App router={router} />)
  await userEvent.click(
    await screen.findByRole('button', { name: 'Créer un projet' }),
  )
  const input = screen.getByRole('dialog').querySelector('input[name="name"]')
  await userEvent.type(input, 'Projet en cours de saisie')
  failed = true
  await act(async () => {
    await router.options.context.queryClient.invalidateQueries({
      queryKey: ['planning', 'validator', 'projects'],
    })
  })
  expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeVisible()
  expect(screen.getByDisplayValue('Projet en cours de saisie')).toBeVisible()
  failed = false
  await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Réessayer' }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.getByDisplayValue('Projet en cours de saisie')).toBeVisible()
})

test.each([403, 404])(
  'calendar clears retained results after access denial %s',
  async (status) => {
    const base = annualPageFetch()
    let denied = false
    vi.stubGlobal(
      'fetch',
      vi.fn((url, options) => {
        const path = String(url)
        if (path.includes('/ptas/pta-1/activities'))
          return Promise.resolve(
            new Response(
              JSON.stringify(
                denied
                  ? { code: 'access_denied', message: 'Accès refusé' }
                  : {
                      object: 'list',
                      count: 1,
                      data: [
                        {
                          id: 'calendar-only',
                          name: 'Activité confidentielle',
                          planned_start: '2027-03-01',
                          planned_end: '2027-03-20',
                        },
                      ],
                      next: null,
                      previous: null,
                    },
              ),
              { status: denied ? status : 200 },
            ),
          )
        return base(url, options)
      }),
    )
    const router = makeRouter(
      createMemoryHistory({
        initialEntries: ['/projects/project-1/ptas/2027?view=calendar'],
      }),
    )
    render(<App router={router} />)
    await screen.findByText('Activité confidentielle')
    denied = true
    await act(async () => {
      await router.options.context.queryClient.invalidateQueries({
        queryKey: ['planning', 'agent', 'activities'],
      })
    })
    await waitFor(() =>
      expect(
        screen.queryByText('Activité confidentielle'),
      ).not.toBeInTheDocument(),
    )
    const queries = router.options.context.queryClient.getQueriesData({
      queryKey: ['planning', 'agent', 'activities'],
    })
    expect(queries.every(([, value]) => value == null)).toBe(true)
  },
)

test('an assigned Agent completes a start-only brief and gets clear missing-date feedback', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <ActivityForm
      year={2027}
      initial={{
        version: 4,
        name: 'Brief',
        description: '',
        planned_start: '2027-01-01',
        planned_end: null,
        allocation: null,
        tasks: [],
      }}
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onSubmit={submit}
    />,
  )
  expect(
    screen.getByLabelText('Intitulé de l’activité', { exact: true }),
  ).toHaveValue('Brief')
  expect(
    screen.getByRole('button', { name: /^Date de fin/ }),
  ).toHaveTextContent('Choisir une date')
  await user.type(screen.getByLabelText('Description'), 'Plan complété')
  await user.click(screen.getByRole('button', { name: /Ajouter une tâche/ }))
  await selectOption(screen.getByLabelText('Catégorie'), 'Atelier')
  await user.type(screen.getByLabelText('Intitulé'), 'Préparer')
  await user.type(screen.getByLabelText('Montant prévu de la tâche'), '10')
  await user.click(screen.getByRole('button', { name: 'Enregistrer la tâche' }))
  await user.type(
    screen.getByLabelText('Montant prévu de l’activité (F CFA)'),
    '10',
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({ planned_end: null, allocation: '10' }),
    'draft',
  )
  await user.click(
    screen.getByRole('button', { name: 'Soumettre pour prévalidation' }),
  )
  expect(
    screen
      .getByRole('heading', { name: 'À corriger avant soumission' })
      .closest('[role="alert"]'),
  ).toHaveTextContent('Renseignez une période valide pour l’activité')
  expect(screen.getByRole('button', { name: /^Date de fin/ })).toHaveAttribute(
    'data-value-missing',
    'true',
  )
  await user.click(screen.getAllByRole('button', { name: /^Date de fin/ })[0])
  await user.click(
    screen.getByRole('button', { name: /dimanche 31 janvier 2027/i }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({
      expected_version: 4,
      planned_start: '2027-01-01',
      planned_end: '2027-01-31',
      allocation: '10',
    }),
    'draft',
  )
  await user.click(screen.getByRole('button', { name: 'Modifier' }))
  await user.type(screen.getByLabelText('Pondération de la tâche (%)'), '100')
  await user.click(screen.getByRole('button', { name: /^Début prévu/ }))
  await user.click(
    screen.getByRole('button', { name: /vendredi 1 janvier 2027/i }),
  )
  await user.click(screen.getByRole('button', { name: /^Fin prévu/ }))
  await user.click(
    screen.getByRole('button', { name: /dimanche 31 janvier 2027/i }),
  )
  await user.click(screen.getByRole('button', { name: 'Enregistrer la tâche' }))
  await user.click(
    screen.getByRole('button', { name: 'Soumettre pour prévalidation' }),
  )
  expect(submit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      tasks: [expect.objectContaining({ name: 'Préparer', allocation: '10' })],
    }),
    'submit',
  )
})

test('a started Task must be completed or removed without losing its input', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <ActivityForm
      year={2027}
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onSubmit={submit}
    />,
  )
  await user.type(
    screen.getByLabelText('Intitulé de l’activité', { exact: true }),
    'Brouillon terrain',
  )
  await user.click(screen.getByRole('button', { name: 'Ajouter une tâche' }))
  await user.type(screen.getByLabelText('Intitulé'), 'Préparer')
  expect(
    screen.getByRole('button', { name: 'Enregistrer la tâche' }),
  ).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Enregistrer la tâche' }))
  expect(screen.getByLabelText('Montant prévu de la tâche')).toHaveAttribute(
    'data-value-missing',
    'true',
  )
  expect(screen.getByLabelText('Intitulé')).toHaveValue('Préparer')
  expect(submit).not.toHaveBeenCalled()
})

test('leaving the Task page restores focus to the Activity Task section', async () => {
  const user = userEvent.setup()
  render(
    <ActivityForm
      year={2027}
      initial={{
        version: 1,
        name: 'Brouillon',
        description: '',
        planned_start: null,
        planned_end: null,
        allocation: '100',
        tasks: [
          {
            id: 'task-1',
            type_id: null,
            name: 'Préparer',
            allocation: '100',
            subtasks: [],
          },
        ],
      }}
      types={[]}
      pending={false}
      onSubmit={vi.fn()}
    />,
  )
  const taskHeading = () =>
    screen.getByRole('heading', { name: 'Tâches et budget' })

  await user.click(screen.getByRole('button', { name: 'Modifier' }))
  await user.click(screen.getByRole('button', { name: 'Annuler' }))
  await waitFor(() => expect(taskHeading()).toHaveFocus())

  await user.click(screen.getByRole('button', { name: 'Modifier' }))
  await user.click(screen.getByRole('button', { name: 'Enregistrer la tâche' }))
  await waitFor(() => expect(taskHeading()).toHaveFocus())
})

test('a Task started only through its description is not silently discarded', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <ActivityForm
      year={2027}
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onSubmit={submit}
    />,
  )
  await user.type(
    screen.getByLabelText('Intitulé de l’activité', { exact: true }),
    'Brouillon descriptif',
  )
  await user.click(screen.getByRole('button', { name: 'Ajouter une tâche' }))
  await user.type(screen.getByLabelText('Description'), 'À organiser')
  expect(
    screen.getByRole('button', { name: 'Enregistrer la tâche' }),
  ).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Enregistrer la tâche' }))
  expect(screen.getByLabelText('Intitulé')).toHaveAttribute(
    'data-value-missing',
    'true',
  )
  expect(screen.getByLabelText('Montant prévu de la tâche')).toHaveAttribute(
    'data-value-missing',
    'true',
  )
  expect(submit).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Description')).toHaveValue('À organiser')
})

test('an Activity attachment stays attached to the saved Draft command', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  const file = new File(['preuve'], 'preuve.pdf', {
    type: 'application/pdf',
  })
  render(
    <ActivityForm
      year={2027}
      initial={{
        version: 2,
        name: 'Brouillon documenté',
        description: '',
        planned_start: null,
        planned_end: null,
        allocation: null,
        tasks: [],
      }}
      types={[]}
      pending={false}
      onSubmit={submit}
    />,
  )

  await user.upload(screen.getByLabelText('Fichier facultatif'), file)
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
  )

  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({ expected_version: 2 }),
    'draft',
    file,
  )
})

test('removing a Task requires confirmation before changing the Draft', async () => {
  const user = userEvent.setup()
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  render(
    <ActivityForm
      year={2027}
      initial={{
        version: 1,
        name: 'Brouillon',
        description: '',
        planned_start: null,
        planned_end: null,
        allocation: '100',
        tasks: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            type_id: null,
            name: 'Préparation',
            allocation: '100',
            subtasks: [],
          },
        ],
      }}
      types={[]}
      pending={false}
      onSubmit={vi.fn()}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Retirer' }))
  const dialog = screen.getByRole('dialog', { name: 'Retirer la tâche' })
  expect(screen.getByText('Préparation')).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Retirer' }))
  expect(screen.queryByText('Préparation')).not.toBeInTheDocument()
  expect(screen.getByText('Aucune tâche.')).toBeVisible()
})
