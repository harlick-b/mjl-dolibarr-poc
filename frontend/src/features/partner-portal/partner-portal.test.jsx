import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router'

afterEach(() => {
  window.dispatchEvent(new Event('online'))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('a Partner sees only the read-only portfolio projection', async () => {
  let ficheDownloads = 0
  let resolveLateDownload
  let denyProjects = false
  const createObjectURL = vi.fn(() => 'blob:partner-fiche')
  const revokeObjectURL = vi.fn()
  const NativeURL = URL
  class DownloadURL extends NativeURL {}
  DownloadURL.createObjectURL = createObjectURL
  DownloadURL.revokeObjectURL = revokeObjectURL
  vi.stubGlobal('URL', DownloadURL)
  const downloadClick = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      let body
      if (path.includes('/auth/session'))
        body = {
          state: 'verified',
          csrf: 'fixture',
          user: {
            id: 'partner-user',
            email: 'user@example.test',
            role: 'PARTENAIRE',
            partner_id: 'partner-1',
          },
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        }
      else if (path.endsWith('/partner-portal/profile'))
        body = { id: 'partner-1', name: 'Partenaire Démonstration' }
      else if (path.includes('/partner-portal/projects?'))
        if (denyProjects)
          return Promise.resolve(new Response('{}', { status: 403 }))
        else
          body = {
            object: 'list',
            count: 1,
            data: [
              {
                id: 'project-1',
                reference: 'PRJ-2027-001',
                name: 'Projet Santé',
                state: 'active',
              },
            ],
            next: null,
            previous: null,
          }
      else if (path.includes('/projects/project-1/ptas'))
        body = {
          object: 'list',
          count: 1,
          data: [
            {
              id: 'pta-1',
              year: 2027,
              metrics: {
                pta_id: 'pta-1',
                as_of: '2027-10-30T10:00:00Z',
                physical: { closed_activities: 1, approved_activities: 2 },
                financial: {
                  closed_spending: '90000',
                  approved_allocation: '120000',
                },
              },
            },
          ],
          next: null,
          previous: null,
        }
      else if (path.includes('/ptas/pta-1/activities'))
        body = {
          object: 'list',
          count: 1,
          data: [
            {
              id: 'activity-1',
              reference: 'ACT-001',
              name: 'Campagne de santé',
              planned_start: '2027-01-10',
              planned_end: '2027-03-10',
              allocation: '120000',
              state: 'closed',
              approved_revision: 1,
            },
          ],
          next: null,
          previous: null,
        }
      else if (path.endsWith('/activities/activity-1'))
        body = {
          id: 'activity-1',
          reference: 'ACT-001',
          name: 'Campagne de santé',
          description: 'Consultations communautaires approuvées.',
          planned_start: '2027-01-10',
          planned_end: '2027-03-10',
          allocation: '120000',
          state: 'closed',
          approved_revision: 2,
          context: {
            partner: 'Partenaire Démonstration',
            project_reference: 'PRJ-2027-001',
            project: 'Projet Santé',
            year: 2027,
          },
          operations: [
            {
              name: 'Consultations',
              description: 'Trois journées de consultations.',
              allocation: '120000',
              final_spending: '90000',
            },
          ],
          decisions: [
            {
              kind: 'initial',
              revision: 1,
              decided_at: '2027-01-05T10:00:00Z',
            },
            {
              kind: 'amendment',
              revision: 2,
              decided_at: '2027-02-05T10:00:00Z',
            },
          ],
          finance: {
            approved_allocation: '120000',
            final_spending: '90000',
            zero_spending: false,
            confirmed_transfer_amount: '90000',
            confirmed_transfer_date: '2027-03-11',
            reversement_required: '30000',
            reversement_amount: '30000',
            reversement_date: '2027-03-12',
            closed_at: '2027-03-13T10:00:00Z',
          },
        }
      else if (path.endsWith('/activities/activity-1/fiche.pdf'))
        if (++ficheDownloads === 2)
          return new Promise((resolve) => {
            resolveLateDownload = () =>
              resolve(
                new Response('late partner pdf', {
                  headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition':
                      'attachment; filename="late-partner-fiche.pdf"',
                  },
                }),
              )
          })
        else
          return Promise.resolve(
            new Response('partner pdf', {
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition':
                  'attachment; filename="fiche-partenaire-ACT-001.pdf"',
              },
            }),
          )
      else return Promise.resolve(new Response('{}', { status: 404 }))
      return Promise.resolve(new Response(JSON.stringify(body)))
    }),
  )

  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner'] }),
  )
  render(<App router={router} />)

  expect(
    await screen.findByRole('heading', {
      name: 'Bonjour, Partenaire Démonstration',
    }),
  ).toBeVisible()
  expect(screen.getByText('Espace Partenaire · Lecture seule')).toBeVisible()
  const navigation = screen.getByRole('navigation', {
    name: 'Espace Partenaire',
  })
  expect(within(navigation).getAllByRole('link')).toHaveLength(3)
  expect(screen.getByRole('button', { name: 'Mon compte' })).toBeVisible()
  expect(await screen.findByText('Projet Santé')).toBeVisible()
  expect(await screen.findByText('Campagne de santé')).toBeVisible()
  expect(screen.getByText('1 activité clôturée sur 2')).toBeVisible()
  expect(
    within(navigation).getByRole('link', { name: 'Exports' }),
  ).toHaveAttribute('href', '/partner/exports')
  expect(screen.queryByText(/pièce jointe/i)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Voir le détail' }))
  expect(
    await screen.findByText('Consultations communautaires approuvées.'),
  ).toBeVisible()
  expect(screen.getByText('Trois journées de consultations.')).toBeVisible()
  expect(screen.getByText('Modification approuvée')).toBeVisible()
  expect(screen.getByText(/10 janvier 2027/)).toBeVisible()
  expect(screen.getByText(/5 février 2027/)).toBeVisible()
  expect(screen.getAllByText(/90.000 F CFA/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/30.000 F CFA/).length).toBeGreaterThanOrEqual(2)
  expect(screen.getByText(/11 mars 2027/)).toBeVisible()
  expect(screen.getByText(/12 mars 2027/)).toBeVisible()
  expect(screen.getByText('13 mars 2027')).toBeVisible()
  expect(screen.queryByText(/commentaire interne/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/pièce jointe/i)).not.toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: 'Télécharger la fiche PDF' }),
  )
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
  expect(downloadClick).toHaveBeenCalledOnce()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:partner-fiche')
  fireEvent.click(
    screen.getByRole('button', { name: 'Télécharger la fiche PDF' }),
  )
  await waitFor(() => expect(resolveLateDownload).toBeTypeOf('function'))
  denyProjects = true
  await act(() =>
    router.options.context.queryClient.refetchQueries({
      queryKey: ['partner-portal', 'partner-user', 'projects'],
    }),
  )
  resolveLateDownload()
  expect(await screen.findByRole('alert')).toHaveTextContent('indisponible')
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
})

test('Partner detail distinguishes unfinished and validated-zero finance', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: {
                id: 'partner-user',
                email: 'user@example.test',
                role: 'PARTENAIRE',
              },
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/partner-portal/profile'))
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'p1', name: 'Partenaire' })),
        )
      if (path.includes('/partner-portal/projects?'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 1,
              data: [
                {
                  id: 'project-1',
                  reference: 'PRJ-001',
                  name: 'Projet',
                  state: 'active',
                },
              ],
              next: null,
              previous: null,
            }),
          ),
        )
      if (path.includes('/projects/project-1/ptas'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 1,
              data: [
                {
                  id: 'pta-1',
                  year: 2027,
                  metrics: {
                    physical: {
                      closed_activities: 1,
                      approved_activities: 2,
                    },
                    financial: {
                      closed_spending: '0',
                      approved_allocation: '200000',
                    },
                  },
                },
              ],
              next: null,
              previous: null,
            }),
          ),
        )
      if (path.includes('/ptas/pta-1/activities'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 2,
              data: [
                {
                  id: 'open',
                  reference: 'ACT-OPEN',
                  name: 'Activité en cours',
                  planned_start: '2027-01-01',
                  planned_end: '2027-02-01',
                  allocation: '100000',
                  state: 'approved',
                  approved_revision: 1,
                },
                {
                  id: 'zero',
                  reference: 'ACT-ZERO',
                  name: 'Activité sans dépense',
                  planned_start: '2027-03-01',
                  planned_end: '2027-04-01',
                  allocation: '100000',
                  state: 'closed',
                  approved_revision: 1,
                },
              ],
              next: null,
              previous: null,
            }),
          ),
        )
      const activityId = path.endsWith('/activities/open')
        ? 'open'
        : path.endsWith('/activities/zero')
          ? 'zero'
          : null
      if (activityId) {
        const zero = activityId === 'zero'
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: activityId,
              reference: zero ? 'ACT-ZERO' : 'ACT-OPEN',
              name: zero ? 'Activité sans dépense' : 'Activité en cours',
              description: 'Description approuvée.',
              planned_start: zero ? '2027-03-01' : '2027-01-01',
              planned_end: zero ? '2027-04-01' : '2027-02-01',
              allocation: '100000',
              state: zero ? 'closed' : 'approved',
              approved_revision: 1,
              context: {
                partner: 'Partenaire',
                project_reference: 'PRJ-001',
                project: 'Projet',
                year: 2027,
              },
              operations: [],
              decisions: [
                {
                  kind: 'initial',
                  revision: 1,
                  decided_at: '2027-01-01T10:00:00Z',
                },
              ],
              finance: zero
                ? {
                    approved_allocation: '100000',
                    final_spending: '0',
                    zero_spending: true,
                    confirmed_transfer_amount: null,
                    confirmed_transfer_date: null,
                    reversement_required: '0',
                    reversement_amount: null,
                    reversement_date: null,
                    closed_at: '2027-04-03T10:00:00Z',
                  }
                : null,
            }),
          ),
        )
      }
      return Promise.resolve(new Response('{}', { status: 404 }))
    }),
  )
  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/partner'] }))}
    />,
  )
  const openRow = (await screen.findByText('Activité en cours')).closest('li')
  fireEvent.click(
    within(openRow).getByRole('button', { name: 'Voir le détail' }),
  )
  expect(
    await screen.findByText(
      'Le résultat financier sera disponible après la clôture.',
    ),
  ).toBeVisible()
  const zeroRow = screen.getByText('Activité sans dépense').closest('li')
  fireEvent.click(
    within(zeroRow).getByRole('button', { name: 'Voir le détail' }),
  )
  expect(await screen.findByText('Dépense nulle validée')).toBeVisible()
  expect(screen.getByText('Aucun virement requis')).toBeVisible()
  expect(screen.getByText('Aucun reversement requis')).toBeVisible()
  expect(screen.getByText('3 avril 2027')).toBeVisible()
  expect(screen.getAllByText(/0 F CFA/).length).toBeGreaterThanOrEqual(2)
})

test('offline invalidation removes the Partner portfolio immediately', async () => {
  let sessionUnavailable = false
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session') && sessionUnavailable)
        return Promise.resolve(new Response('{}', { status: 503 }))
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: {
                id: 'partner-user',
                email: 'user@example.test',
                role: 'PARTENAIRE',
                partner_id: 'partner-1',
              },
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/partner-portal/profile'))
        return Promise.resolve(
          new Response(
            JSON.stringify({ id: 'partner-1', name: 'Donnée privée' }),
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
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner'] }),
  )
  render(<App router={router} />)
  expect(await screen.findByText('Bonjour, Donnée privée')).toBeVisible()
  await act(async () => window.dispatchEvent(new Event('offline')))
  expect(screen.queryByText('Bonjour, Donnée privée')).not.toBeInTheDocument()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Connexion indisponible',
  )
  expect(
    router.options.context.queryClient
      .getQueriesData({ queryKey: ['partner-portal'] })
      .every(([, data]) => data === undefined),
  ).toBe(true)
  sessionUnavailable = true
  fireEvent(window, new Event('online'))
  expect(
    await screen.findByText(
      'Le service est momentanément indisponible. Votre accès local a été fermé. Réessayez pour vous connecter à nouveau.',
    ),
  ).toBeVisible()
  expect(screen.queryByText('Bonjour, Donnée privée')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Réessayer la connexion' }),
  ).toBeEnabled()
  expect(router.state.location.pathname).toBe('/login')
})

test('a denied portal read removes that view without invalidating the session', async () => {
  let projects = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: {
                id: 'partner-user',
                email: 'user@example.test',
                role: 'PARTENAIRE',
              },
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/partner-portal/profile'))
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'p1', name: 'Donnée privée' })),
        )
      if (path.includes('/partner-portal/projects?')) {
        projects += 1
        return Promise.resolve(
          projects === 1
            ? new Response(
                JSON.stringify({
                  object: 'list',
                  count: 0,
                  data: [],
                  next: null,
                  previous: null,
                }),
              )
            : new Response('{}', { status: 403 }),
        )
      }
      return Promise.resolve(new Response('{}', { status: 404 }))
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner'] }),
  )
  const view = render(<App router={router} />)
  expect(await screen.findByText('Bonjour, Donnée privée')).toBeVisible()
  view.unmount()
  await router.options.context.queryClient.invalidateQueries({
    queryKey: ['partner-portal'],
  })
  render(<App router={router} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('indisponible')
  expect(screen.queryByText('Bonjour, Donnée privée')).toBeNull()
})

test('a denied profile refetch removes its identity and dependent projections', async () => {
  let denyProfile = false
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'fixture',
              user: {
                id: 'partner-user',
                email: 'partner@example.test',
                role: 'PARTENAIRE',
              },
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/partner-portal/profile'))
        return Promise.resolve(
          denyProfile
            ? new Response('{}', { status: 403 })
            : new Response(JSON.stringify({ id: 'p1', name: 'Donnée privée' })),
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
    }),
  )
  const router = makeRouter(
    createMemoryHistory({ initialEntries: ['/partner'] }),
  )
  render(<App router={router} />)
  expect(await screen.findByText('Bonjour, Donnée privée')).toBeVisible()

  denyProfile = true
  await act(async () =>
    router.options.context.queryClient.invalidateQueries({
      queryKey: ['partner-portal', 'partner-user', 'profile'],
    }),
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('indisponible')
  expect(screen.queryByText('Bonjour, Donnée privée')).not.toBeInTheDocument()
  expect(
    router.options.context.queryClient.getQueryData(['auth', 'session']).state,
  ).toBe('verified')
  expect(
    router.options.context.queryClient
      .getQueriesData({ queryKey: ['partner-portal', 'partner-user'] })
      .every(([, data]) => data === null),
  ).toBe(true)
})

test('an initially offline portal never requests private portfolio data', async () => {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
  const fetch = vi.fn((url) => {
    if (String(url).includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'fixture',
            user: {
              id: 'partner-user',
              email: 'user@example.test',
              role: 'PARTENAIRE',
            },
          }),
        ),
      )
    return Promise.resolve(new Response('{}'))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/partner'] }))}
    />,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Connexion indisponible',
  )
  expect(
    fetch.mock.calls.every(
      ([url]) => !String(url).includes('/partner-portal/'),
    ),
  ).toBe(true)
})

test('portal pagination follows server cursors through router search', async () => {
  const fetch = vi.fn((url) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'fixture',
            user: {
              id: 'partner-user',
              email: 'user@example.test',
              role: 'PARTENAIRE',
            },
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/partner-portal/profile'))
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'p1', name: 'Partenaire' })),
      )
    if (path.includes('/partner-portal/projects?')) {
      const second = path.includes('cursor=second')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: [
              {
                id: second ? 'project-2' : 'project-1',
                reference: second ? 'PRJ-002' : 'PRJ-001',
                name: second ? 'Projet Deux' : 'Projet Un',
                state: 'active',
              },
            ],
            next: second
              ? null
              : 'http://localhost/api/v1/partner-portal/projects?limit=60&cursor=second',
            previous: second
              ? 'http://localhost/api/v1/partner-portal/projects?limit=60'
              : null,
          }),
        ),
      )
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
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(createMemoryHistory({ initialEntries: ['/partner'] }))}
    />,
  )
  expect(await screen.findByText('Projet Un')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
  expect(await screen.findByText('Projet Deux')).toBeVisible()
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) => String(url).includes('cursor=second')),
    ).toBe(true),
  )
  expect(screen.getByRole('button', { name: 'Précédent' })).toBeEnabled()
})

test('a verified Partner can enter the portal from the profile sidebar', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            String(url).endsWith('/auth/profile')
              ? {
                  full_name: 'Partner Test',
                  first_name: 'Partner',
                  last_name: 'Test',
                  email: 'partner@example.test',
                  role: 'PARTENAIRE',
                }
              : {
                  state: 'verified',
                  csrf: 'csrf',
                  user: {
                    id: 'partner-user',
                    email: 'partner@example.test',
                    role: 'PARTENAIRE',
                    partner_id: 'partner-1',
                  },
                  expires_at: new Date(Date.now() + 60_000).toISOString(),
                },
          ),
        ),
      ),
    ),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/identity'] }),
      )}
    />,
  )
  expect(
    await screen.findByRole('link', {
      name: 'Mes projets',
    }),
  ).toHaveAttribute('href', '/partner')
})
