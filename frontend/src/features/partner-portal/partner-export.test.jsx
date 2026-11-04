import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router'

const list = (data) => ({
  object: 'list',
  count: data.length,
  data,
  next: null,
  previous: null,
})
const label = 'Télécharger le récapitulatif CSV'
afterEach(() => {
  window.dispatchEvent(new Event('online'))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function fixture(download) {
  let denied = false
  const deny = () => {
    denied = true
  }
  const create = vi.fn(() => 'blob:csv')
  const revoke = vi.fn()
  const NativeURL = URL
  class DownloadURL extends NativeURL {}
  DownloadURL.createObjectURL = create
  DownloadURL.revokeObjectURL = revoke
  vi.stubGlobal('URL', DownloadURL)
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
  const requests = vi.fn(download)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      const path = String(url)
      if (denied && path.includes('/projects?'))
        return new Response('{}', { status: 403 })
      if (path.endsWith('/exports')) return requests(path, options)
      let body
      if (path.includes('/auth/session'))
        body = {
          state: 'verified',
          csrf: 'csv-csrf',
          user: { id: 'partner', role: 'PARTENAIRE', partner_id: 'partner-1' },
        }
      else if (path.endsWith('/profile')) body = { name: 'Partenaire' }
      else if (path.includes('/projects?'))
        body = list([{ id: 'project', name: 'Projet', state: 'active' }])
      else if (path.includes('/ptas?'))
        body = list(
          ['pta-1', 'pta-2'].map((id, i) => ({
            id,
            year: 2027 + i,
            metrics: {
              physical: { closed_activities: 0, approved_activities: 1 },
              financial: { closed_spending: '0', approved_allocation: '100' },
            },
          })),
        )
      else if (path.includes('/activities?')) body = list([])
      else return new Response('{}', { status: 404 })
      return new Response(JSON.stringify(body))
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner?pta=pta-2'] }),
  )
  render(<App router={router} />)
  return { create, revoke, click, requests, router, deny }
}
const csv = () =>
  new Response('\ufeffNom;Budget\nActivité;100', {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="pta-partenaire-2028.csv"',
    },
  })

test('selected PTA CSV uses protected POST and downloads once without replay', async () => {
  const { requests, create, click, revoke } = fixture(csv)
  fireEvent.click(await screen.findByRole('button', { name: label }))
  await waitFor(() => expect(click).toHaveBeenCalledOnce())
  const [path, options] = requests.mock.calls[0]
  expect(path).toContain('/ptas/pta-2/exports')
  expect(options.method).toBe('POST')
  expect(options.headers['X-CSRF-Token']).toBe('csv-csrf')
  expect(JSON.parse(options.body)).toEqual({ format: 'csv' })
  expect(create).toHaveBeenCalledOnce()
  await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:csv'))
  act(() => window.dispatchEvent(new Event('online')))
  expect(requests).toHaveBeenCalledOnce()
})

test('CSV failures require manual retry and offline clicks never queue', async () => {
  const { requests, click } = fixture(() => new Response('{}', { status: 503 }))
  fireEvent.click(await screen.findByRole('button', { name: label }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'téléchargement du CSV a échoué',
  )
  expect(requests).toHaveBeenCalledOnce()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  fireEvent.click(screen.getByRole('button', { name: label }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: label })).toBeEnabled(),
  )
  expect(requests).toHaveBeenCalledOnce()
  expect(click).not.toHaveBeenCalled()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  act(() => window.dispatchEvent(new Event('online')))
  expect(requests).toHaveBeenCalledOnce()
})

test.each(['navigation', 'offline', 'access loss'])(
  'late CSV bytes are discarded after %s',
  async (change) => {
    let resolve
    const { requests, create, router, deny } = fixture(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    fireEvent.click(await screen.findByRole('button', { name: label }))
    await waitFor(() => expect(requests).toHaveBeenCalledOnce())
    if (change === 'navigation') {
      fireEvent.change(screen.getByLabelText('Année'), {
        target: { value: 'pta-1' },
      })
      await screen.findByRole('heading', { name: 'PTA 2027' })
    } else if (change === 'offline')
      act(() => window.dispatchEvent(new Event('offline')))
    else
      await act(async () => {
        deny()
        await router.options.context.queryClient.refetchQueries({
          queryKey: ['partner-portal', 'partner', 'projects'],
        })
      })
    await act(async () => resolve(csv()))
    expect(create).not.toHaveBeenCalled()
  },
)
