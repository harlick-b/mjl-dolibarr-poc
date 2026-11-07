import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, vi } from 'vitest'
import { RestClientProvider } from '@/shared/api/RestClientProvider'
import { RestClient } from '@/shared/api/rest-client'
import { ActivityDocuments } from './PlanningView'

test.each([
  [403, 'download'],
  [404, 'download'],
  [403, 'list'],
  [404, 'list'],
  [503, 'list'],
])(
  'document failure %s on %s clears only denied projections',
  async (status, source) => {
    let listFailed = false
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function () {
      this.open = false
    }
    const NativeURL = URL
    class PreviewURL extends NativeURL {}
    PreviewURL.createObjectURL = vi.fn(() => 'blob:protected-image')
    PreviewURL.revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', PreviewURL)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path) => {
        if (path.endsWith('/preview')) return new Response('image')
        if (listFailed && source === 'list')
          return new Response('{}', { status })
        if (path.endsWith('/download')) return new Response('{}', { status })
        return new Response(
          JSON.stringify({
            data: [
              { id: 'image', name: 'preuve.png', media_type: 'image/png' },
              { id: 'other', name: 'autre.pdf', media_type: 'application/pdf' },
            ],
            count: 2,
            next: null,
            previous: null,
          }),
        )
      }),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <RestClientProvider client={new RestClient()}>
          <ActivityDocuments
            activityId="activity"
            user={{ id: 'agent', role: 'AGENT_SAISIE' }}
            csrf="csrf"
            cursor=""
            navigate={vi.fn()}
            onDenied={vi.fn()}
          />
        </RestClientProvider>
      </QueryClientProvider>,
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Aperçu de preuve.png' }),
    )
    const preview = screen.getByRole('dialog', { name: 'Aperçu — preuve.png' })
    expect(await within(preview).findByRole('img')).toBeVisible()
    if (source === 'download') {
      await userEvent.click(
        within(preview).getByRole('button', { name: 'Télécharger' }),
      )
    } else {
      listFailed = true
      await act(async () => {
        await client.invalidateQueries({
          queryKey: ['planning', 'agent', 'documents', 'activity'],
        })
      })
      await screen.findByText('Les pièces sont indisponibles.')
    }
    if (status === 503) {
      expect(within(preview).getByRole('img')).toBeVisible()
      expect(PreviewURL.revokeObjectURL).not.toHaveBeenCalled()
      return
    }
    await waitFor(() =>
      expect(screen.queryByRole('img')).not.toBeInTheDocument(),
    )
    expect(PreviewURL.revokeObjectURL).toHaveBeenCalledWith(
      'blob:protected-image',
    )
    expect(screen.queryByText('preuve.png')).not.toBeInTheDocument()
    if (source === 'download')
      expect(screen.getByText('autre.pdf')).toBeVisible()
    else {
      expect(screen.queryByText('autre.pdf')).not.toBeInTheDocument()
      const cachedDocuments = client.getQueriesData({
        queryKey: ['planning', 'agent', 'documents', 'activity'],
      })
      expect(JSON.stringify(cachedDocuments)).not.toContain('preuve.png')
      expect(JSON.stringify(cachedDocuments)).not.toContain('autre.pdf')
    }
  },
)

test('assignment loss closes an upload and refreshes retained document permissions', async () => {
  let reads = 0
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path, options = {}) => {
      if (options.method === 'POST')
        return new Response(
          JSON.stringify({ code: 'activity_assignment_required' }),
          { status: 403 },
        )
      reads += 1
      return new Response(
        JSON.stringify({ data: [], count: 0, next: null, previous: null }),
      )
    }),
  )
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RestClientProvider client={new RestClient()}>
        <ActivityDocuments
          activityId="activity"
          assigned
          user={{ id: 'agent', role: 'AGENT_SAISIE' }}
          csrf="csrf"
          cursor=""
          navigate={vi.fn()}
          onDenied={vi.fn()}
        />
      </RestClientProvider>
    </QueryClientProvider>,
  )
  await screen.findByText('Aucune pièce justificative')
  await userEvent.click(
    screen.getByRole('button', { name: 'Ajouter une pièce' }),
  )
  const modal = screen.getByRole('dialog', { name: 'Ajouter une pièce' })
  await userEvent.upload(
    within(modal).getByLabelText('Choisir un fichier PDF, JPEG ou PNG'),
    new File(['image'], 'preuve.png', { type: 'image/png' }),
  )
  expect(
    within(modal).getByLabelText('Choisir un fichier PDF, JPEG ou PNG').files,
  ).toHaveLength(1)
  fireEvent.submit(
    within(modal).getByRole('button', { name: 'Ajouter', exact: true }).form,
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity/documents',
      expect.objectContaining({ method: 'POST' }),
    ),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Ajouter une pièce' }),
    ).not.toBeInTheDocument(),
  )
  expect(reads).toBeGreaterThan(1)
})
