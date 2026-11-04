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
import {
  addThreeMonths,
  formatPercentage,
  formatXof,
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

test('formats an exact integer amount in XOF', () => {
  expect(formatXof('1250000')).toContain('1')
  expect(formatXof('1250000')).toContain('XOF')
})

test('formats annual rates without capping and preserves zero denominators', () => {
  expect(formatPercentage('11', '10')).toBe('110 %')
  expect(formatPercentage('1', '3')).toBe('33,3 %')
  expect(formatPercentage('0', '0')).toBe('Non calculable')
})

function annualPageFetch(exportReply) {
  return vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.endsWith('/ptas/pta-1/exports')) return exportReply(options)
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: { id: 'agent', role: 'AGENT_SAISIE' },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/projects/project-1/ptas/2027'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            project: {
              id: 'project-1',
              name: 'Projet métriques',
              allowed_actions: ['read'],
            },
            year: 2027,
            pta: { id: 'pta-1' },
            allowed_actions: ['read'],
            approved_plan: { activity_count: 5, allocation: '9200000' },
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

function renderAnnualPage() {
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: ['/projects/project-1/ptas/2027'],
        }),
      )}
    />,
  )
}

test('the annual plan shows whole-PTA physical and financial metrics', async () => {
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
    name: 'Indicateurs annuels',
  })
  expect(within(metrics).getByText('Exécution physique')).toBeVisible()
  expect(within(metrics).getByText('20 %')).toBeVisible()
  expect(within(metrics).getByText('Exécution financière')).toBeVisible()
  expect(within(metrics).getByText('10,9 %')).toBeVisible()
  expect(within(metrics).getByText(/1 activité.*5 approuvée/)).toBeVisible()
  expect(within(metrics).getByText(/1.*000.*000.*9.*200.*000/)).toBeVisible()
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
  await screen.findByRole('region', { name: 'Indicateurs annuels' })

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
    await screen.findByRole('heading', { name: 'Accès à vérifier' }),
  ).toBeVisible()
  expect(exportSignal.aborted).toBe(true)
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

test('an authorization loss during annual export denies the workspace', async () => {
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
  await screen.findByRole('region', { name: 'Indicateurs annuels' })

  await user.click(
    screen.getByRole('button', { name: 'Exporter le PTA en CSV' }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Accès à vérifier' }),
  ).toBeVisible()
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
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  const activity = {
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
    operations: [
      {
        id: 'operation-1',
        type_id: 'type-1',
        name: 'Préparer',
        allocation: '100000',
        position: 1,
      },
    ],
    agent_ids: [],
    allowed_actions: ['read', 'edit', 'submit'],
  }
  const fetch = vi.fn((url, options = {}) => {
    if (url.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: { id: 'agent', role: 'AGENT_SAISIE' },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (options.method === 'POST')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'revision-1',
            revision_number: 1,
            activity_version: 2,
          }),
          { status: 201 },
        ),
      )
    if (url.endsWith('/activities/activity-1'))
      return Promise.resolve(new Response(JSON.stringify(activity)))
    if (url.includes('/activities/activity-1/revisions'))
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
    operations: [
      {
        id: 'operation-1',
        type_id: 'type-1',
        name: 'Préparer',
        allocation: '100000',
        position: 1,
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
    operations: approved.operations,
    correction: null,
    agent_ids: [],
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
            user: { id: 'agent', role: 'AGENT_SAISIE' },
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
  expect(
    await screen.findByRole('link', { name: 'Télécharger la fiche PDF' }),
  ).toHaveAttribute('href', '/api/v1/activities/activity-1/fiche.pdf')
  expect(await screen.findByText('Aucune pièce justificative.')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Ajouter une pièce' }))
  await user.upload(
    screen.getByLabelText('Choisir un fichier PDF, JPEG ou PNG'),
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
  const imageRow = (await screen.findByText('preuve.png')).closest('li')
  expect(
    within(imageRow).getByRole('link', { name: 'Télécharger' }),
  ).toHaveAttribute(
    'href',
    '/api/v1/activities/activity-1/documents/document-1/download',
  )
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
  await user.click(within(preview).getByRole('button', { name: 'Fermer' }))
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
    within(preview).getByRole('link', { name: 'Télécharger' }),
  ).toHaveAttribute(
    'href',
    '/api/v1/activities/activity-1/documents/document-1/download',
  )
  await user.click(within(preview).getByRole('button', { name: 'Fermer' }))
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
    within(withdrawalDialog).getByLabelText('Motif du retrait'),
    'Pièce incorrecte.',
  )
  expect(
    within(withdrawalDialog).queryByRole('option', { name: 'preuve.png' }),
  ).toBeNull()
  await user.click(
    within(withdrawalDialog).getByRole('button', { name: 'Suivant' }),
  )
  await within(withdrawalDialog).findByRole('option', { name: 'preuve.png' })
  await user.selectOptions(
    within(withdrawalDialog).getByLabelText('Pièce corrigée (facultatif)'),
    'document-1',
  )
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
      search: (previous) => ({ ...previous, documentCursor: undefined }),
    })
  })
  await screen.findByText('preuve.png')
  await user.click(
    await screen.findByRole('button', { name: 'Demander une modification' }),
  )
  await user.type(screen.getByLabelText('Motif de la modification'), 'Adapter.')
  await user.click(
    screen.getByRole('dialog').querySelector('button[type="submit"]'),
  )
  expect(
    await screen.findByText(/exécution de cette activité est suspendue/i),
  ).toBeVisible()
  expect(
    screen.getByRole('region', { name: 'Version approuvée' }),
  ).toBeVisible()
  expect(
    screen.getByRole('region', { name: 'Modification en préparation' }),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Annuler la modification' }),
  )
  await user.type(
    screen.getByLabelText('Motif de l’annulation'),
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
    screen.getByLabelText('Motif du retrait'),
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
  expect(
    router.options.context.queryClient.getQueryState(accessKey)?.isInvalidated,
  ).toBe(true)
  await user.click(
    screen.getByRole('button', { name: 'Annuler la demande de retrait' }),
  )
  await user.type(
    screen.getByLabelText('Motif de l’annulation'),
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
  expect(screen.getByText(/Les Opérations et leurs montants/)).toBeVisible()
  await user.type(
    screen.getByLabelText('Motif du transfert'),
    'Calendrier 2028.',
  )
  await user.type(screen.getByLabelText('Nouvelle date de début'), '2028-02-01')
  expect(screen.getByText('PTA cible :').parentElement).toHaveTextContent(
    '2028',
  )
  await user.type(screen.getByLabelText('Nouvelle date de fin'), '2028-08-31')
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
        }),
      }),
    ),
  )
  expect(await screen.findByText('Demande de transfert en cours')).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Annuler la demande de transfert' }),
  )
  await user.type(
    screen.getByLabelText('Motif de l’annulation'),
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
  previewStatus = 403
  await user.click(
    within(screen.getByText('preuve.png').closest('li')).getByRole('button', {
      name: 'Aperçu de preuve.png',
    }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Accès à vérifier' }),
  ).toBeVisible()
}, 10000)

function amendmentHistoryFetch({ failed = false } = {}) {
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
    operations: [],
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
            user: { id: 'agent', role: 'AGENT_SAISIE' },
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
                  operations: [
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

test('approved amendment history renders frozen names, labels, and actor evidence', async () => {
  vi.stubGlobal('fetch', amendmentHistoryFetch())
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: [
            '/activities/activity-1?amendment=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ],
        }),
      )}
    />,
  )
  expect(await screen.findByText('Modification approuvée')).toBeVisible()
  expect(screen.getByText('Nouveau nom approuvé')).toBeVisible()
  expect(screen.getByText(/Formation figée — Former/)).toBeVisible()
  expect(screen.getByText(/Ouverte par agent-1/)).toBeVisible()
})

test('a failed amendment-history request blocks the workspace with an alert', async () => {
  vi.stubGlobal('fetch', amendmentHistoryFetch({ failed: true }))
  render(
    <App
      router={makeRouter(
        createMemoryHistory({
          initialEntries: [
            '/activities/activity-1?amendment=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ],
        }),
      )}
    />,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Les données de planification sont indisponibles.',
  )
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
    operations: [
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
  await user.type(screen.getByLabelText('Nom', { exact: true }), ' modifiée')
  rerender(
    <ActivityForm
      {...props}
      initial={{
        ...initial,
        version: 2,
        planned_end: '2027-05-01',
        operations: [{ ...initial.operations[0], allocation: '200' }],
      }}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({
      expected_version: 1,
      name: 'Activité initiale modifiée',
      allocation: '100',
      planned_end: '2027-04-01',
    }),
  )
})

test('assignment edits retain their base version and can discard a stale draft', async () => {
  const user = userEvent.setup()
  const activity = {
    id: 'assignment-1',
    project_id: 'project-1',
    reference: 'ACT-1',
    name: 'Coordination',
    state: 'draft',
    version: 1,
    planned_start: '2027-01-01',
    planned_end: '2027-04-01',
    allocation: '100',
    operations: [],
    agent_ids: [],
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
          user: { id: 'supervisor', role: 'AGENT_VERIFICATEUR' },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        }
      else if (path.endsWith('/activities/assignment-1')) body = activity
      else if (path.includes('/assignment-agents'))
        body = {
          ...body,
          count: 1,
          data: [{ id: 'agent-1', email: 'agent@example.test' }],
        }
      return new Response(JSON.stringify(body))
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/activities/assignment-1'] }),
  )
  render(<App router={router} />)
  await user.click(
    await screen.findByRole('checkbox', { name: 'agent@example.test' }),
  )
  await act(async () => {
    router.options.context.queryClient.setQueryData(
      ['planning', 'supervisor', 'activity', 'assignment-1'],
      { ...activity, version: 2 },
    )
  })
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer les agents' }),
  )
  await waitFor(() =>
    expect(assigned).toEqual({ expected_version: 1, agent_ids: ['agent-1'] }),
  )
  await user.click(
    screen.getByRole('button', {
      name: 'Annuler les modifications d’affectation',
    }),
  )
  expect(
    screen.getByRole('checkbox', { name: 'agent@example.test' }),
  ).not.toBeChecked()
})

test('a new Activity keeps its request key across a lost-response retry', async () => {
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <ActivityForm
      types={[{ id: 'type-1', label: 'Atelier' }]}
      pending={false}
      onSubmit={submit}
    />,
  )
  await user.type(screen.getByLabelText('Nom', { exact: true }), 'Activité')
  await user.type(screen.getByLabelText('Description'), 'Description')
  await user.type(screen.getByLabelText('Début'), '2027-01-31')
  expect(screen.getByLabelText('Fin')).toHaveValue('2027-04-30')
  await user.clear(screen.getByLabelText('Fin'))
  await user.type(screen.getByLabelText('Fin'), '2027-05-15')
  await user.clear(screen.getByLabelText('Début'))
  await user.type(screen.getByLabelText('Début'), '2027-02-28')
  expect(screen.getByLabelText('Fin')).toHaveValue('2027-05-15')
  await user.selectOptions(
    screen.getByLabelText('Type d’opération 1'),
    'type-1',
  )
  await user.type(screen.getByLabelText('Nom de l’opération 1'), 'Préparer')
  await user.type(screen.getByLabelText('Budget de l’opération 1'), '10')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(submit).toHaveBeenCalledTimes(2)
  expect(submit.mock.calls[0][0].request_key).toBe(
    submit.mock.calls[1][0].request_key,
  )
})

test('an Agent sees the empty projects workspace', async () => {
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
        createMemoryHistory({ initialEntries: ['/projects'] }),
      )}
    />,
  )
  await screen.findByText('Aucun projet.')
  expect(
    screen.getByRole('heading', { name: 'Projets', level: 1 }),
  ).toBeVisible()
  expect(screen.getByText('Aucun projet.')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Créer' }),
  ).not.toBeInTheDocument()
})

test('the technical Admin cannot see planning records', async () => {
  const fetch = vi.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          state: 'verified',
          csrf: 'fixture',
          user: { id: 'admin', role: 'ADMIN_PLATEFORME' },
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
  expect(await screen.findByRole('alert')).toHaveTextContent('rôles métier')
  expect(fetch.mock.calls.every(([url]) => url.includes('/auth/'))).toBe(true)
})

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
                  user: { id: 'validator', role: 'VALIDATEUR_DEFINITIF' },
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
    level: 2,
  })
  const opener = within(heading.closest('.planning-card')).getByRole('button', {
    name: 'Ajouter',
  })
  await user.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Ajouter — Partenaires' })
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
              user: { id: 'validator', role: 'VALIDATEUR_DEFINITIF' },
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
  const opener = await screen.findByRole('button', { name: 'Créer' })
  await user.click(opener)
  await user.type(screen.getByLabelText('Nom'), 'Projet retardé')
  await user.click(screen.getByRole('dialog').getElementsByTagName('button')[0])
  window.dispatchEvent(new Event('offline'))
  expect(
    await screen.findByRole('heading', { name: 'Accès à vérifier' }),
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
              user: { id: 'validator', role: 'VALIDATEUR_DEFINITIF' },
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
    level: 2,
  })
  expect(requestUrls.join('|')).toContain('/api/v1/partners')
  const card = heading.closest('.planning-card')
  await user.click(within(card).getByRole('button', { name: 'Ajouter' }))
  const dialog = within(card).getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), 'Partenaire actualisé')
  await user.click(within(dialog).getByRole('button', { name: 'Ajouter' }))
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
              user: { id: 'validator', role: 'VALIDATEUR_DEFINITIF' },
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
    level: 2,
  })
  const card = heading.closest('.planning-card')
  await user.click(within(card).getByRole('button', { name: 'Ajouter' }))
  const dialog = within(card).getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom'), 'Conflit')
  await user.click(within(dialog).getByRole('button', { name: 'Ajouter' }))
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
              user: { id: 'agent', role: 'AGENT_SAISIE' },
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
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/partners'] }),
      )}
    />,
  )
  await partnerRequested
  window.dispatchEvent(new Event('offline'))
  expect(
    await screen.findByRole('heading', { name: 'Accès à vérifier' }),
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
      operations: [
        {
          id: 'operation-1',
          type_id: 'type-1',
          name: 'Préparer',
          allocation: '100000',
          position: 1,
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
              user: { id: 'agent', role: 'AGENT_SAISIE' },
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
      expect(
        await screen.findByText('Soumise pour prévalidation'),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'Soumettre pour prévalidation' }),
      ).not.toBeInTheDocument()
    } else {
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Les données de planification sont indisponibles.',
      )
      expect(
        screen.queryByRole('button', { name: 'Soumettre pour prévalidation' }),
      ).not.toBeInTheDocument()
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
