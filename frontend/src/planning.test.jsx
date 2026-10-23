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
import { App, makeRouter } from './router'
import { ActivityForm } from './PlanningView'
import { addThreeMonths, formatXof } from './planning'

afterEach(() => {
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
  expect(
    await screen.findByRole('heading', { name: 'Projets', level: 1 }),
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
