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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { App, makeRouter } from '@/app/router'

const empty = { object: 'list', count: 0, data: [], next: null, previous: null }
const project = {
  id: 'project-1',
  name: 'Protection de l’enfant',
  partner_name: 'UNICEF',
  state: 'active',
  allowed_actions: ['read'],
}
const summary = {
  activities: 0,
  approved: 0,
  review: 0,
  correction: 0,
  draft: 0,
  approved_allocation: '0',
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
  toast.dismiss()
  vi.unstubAllGlobals()
})
function setup({
  role = 'AGENT_VERIFICATEUR',
  existing = false,
  save,
  projects = [project],
  projectReply,
} = {}) {
  let pta = existing
    ? {
        id: 'pta-1',
        project_id: project.id,
        year: 2027,
        name: 'Priorités annuelles',
        description: 'Objectifs initiaux',
        version: 3,
        allowed_actions: ['read', 'edit'],
      }
    : null
  const fetcher = vi.fn(async (url, options = {}) => {
    const path = new URL(url, window.location.origin).pathname
    let body = empty
    if (path.endsWith('/auth/session'))
      body = {
        state: 'verified',
        csrf: 'csrf',
        user: { id: 'reviewer', role, email: 'reviewer@example.test' },
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }
    else if (options.method === 'POST' || options.method === 'PATCH') {
      if (save) return save(options)
      pta = {
        id: 'pta-1',
        version: 1,
        project_id: project.id,
        allowed_actions: ['read', 'edit'],
        ...JSON.parse(options.body),
      }
      body = pta
    } else if (path === '/api/v1/projects') {
      if (projectReply) return projectReply()
      body = { ...empty, count: projects.length, data: projects }
    } else if (path === '/api/v1/ptas')
      body = {
        ...empty,
        count: pta ? 1 : 0,
        data: pta
          ? [
              {
                ...pta,
                project_name: project.name,
                partner_name: 'UNICEF',
                summary,
              },
            ]
          : [],
      }
    else if (/\/projects\/project-1\/ptas\/\d{4}$/.test(path))
      body = {
        project,
        year: pta?.year || 2027,
        pta,
        summary,
        allowed_actions: ['read'],
      }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetcher)
  const router = makeRouter(
    createMemoryHistory({
      initialEntries: [
        existing ? '/projects/project-1/ptas/2027' : '/planning',
      ],
    }),
  )
  render(<App router={router} />)
  return {
    fetcher,
    router,
    replacePTA: (value) => {
      pta = { ...pta, ...value }
    },
  }
}
test('reviewer creates a named PTA in a modal and arrives at its detail', async () => {
  const { fetcher, router } = setup()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Créer un PTA' }))
  const dialog = await screen.findByRole('dialog', { name: 'Créer un PTA' })
  await waitFor(() =>
    expect(
      within(dialog).getByRole('combobox', { name: 'Projet *' }),
    ).toHaveTextContent(project.name),
  )
  expect(
    within(dialog).getByRole('combobox', { name: 'Année *' }),
  ).toHaveTextContent(String(new Date().getFullYear()))
  await user.click(within(dialog).getByRole('combobox', { name: 'Année *' }))
  const years = await screen.findAllByRole('option')
  expect(years.map((option) => Number(option.textContent))).toEqual(
    Array.from(
      { length: 13 },
      (_, index) => new Date().getFullYear() - 2 + index,
    ),
  )
  await user.keyboard('{Escape}')
  expect(within(dialog).getByLabelText('Nom du PTA *')).toBeRequired()
  expect(within(dialog).getByLabelText('Description')).not.toBeRequired()
  expect(within(dialog).queryByText(/facultatif/i)).not.toBeInTheDocument()
  fireEvent.change(within(dialog).getByLabelText('Nom du PTA *'), {
    target: { value: 'Plan annuel' },
  })
  fireEvent.change(within(dialog).getByLabelText(/Description/), {
    target: { value: 'Priorités de terrain' },
  })
  await user.click(within(dialog).getByRole('button', { name: 'Créer le PTA' }))
  await screen.findByRole('heading', { name: 'Plan annuel', level: 1 })
  expect(router.state.location.pathname).toBe(
    `/projects/project-1/ptas/${new Date().getFullYear()}`,
  )
  const call = fetcher.mock.calls.find(([, o]) => o.method === 'POST')
  expect(JSON.parse(call[1].body)).toEqual({
    year: new Date().getFullYear(),
    name: 'Plan annuel',
    description: 'Priorités de terrain',
  })
})

test('PTA edit preloads metadata and submits its original version without changing project or year', async () => {
  const { fetcher } = setup({ existing: true })
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'Modifier le PTA' }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Modifier le PTA' })
  expect(within(dialog).getByLabelText('Nom du PTA *')).toHaveValue(
    'Priorités annuelles',
  )
  expect(within(dialog).getByLabelText(/Description/)).toHaveValue(
    'Objectifs initiaux',
  )
  expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
  await user.clear(within(dialog).getByLabelText('Nom du PTA *'))
  await user.type(
    within(dialog).getByLabelText('Nom du PTA *'),
    'Programme révisé',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  const call = fetcher.mock.calls.find(([, o]) => o.method === 'PATCH')
  expect(JSON.parse(call[1].body)).toEqual({
    name: 'Programme révisé',
    description: 'Objectifs initiaux',
    expected_version: 3,
  })
})

test('duplicate PTA leaves the draft in its own modal with a recoverable message', async () => {
  setup({
    save: () =>
      new Response(JSON.stringify({ code: 'pta_exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
  })
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Créer un PTA' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Nom du PTA *'), 'Mon PTA')
  await user.click(within(dialog).getByRole('button', { name: 'Créer le PTA' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Un PTA existe déjà',
  )
  expect(within(dialog).getByLabelText('Nom du PTA *')).toHaveValue('Mon PTA')
  await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('Agents use existing PTAs and cannot create a PTA from the index', async () => {
  setup({ role: 'AGENT_SAISIE' })
  await screen.findByRole('heading', { name: 'Prévisions (PTA)', level: 1 })
  expect(
    screen.queryByRole('button', { name: 'Créer un PTA' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Ajouter une activité au PTA' }),
  ).not.toBeInTheDocument()
})

test('a background refresh cannot replace the version of an open edit draft', async () => {
  const { fetcher, router, replacePTA } = setup({
    existing: true,
    save: () =>
      new Response(JSON.stringify({ code: 'pta_stale' }), { status: 409 }),
  })
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'Modifier le PTA' }),
  )
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Nom du PTA *'), {
    target: { value: 'Mon brouillon' },
  })
  replacePTA({ name: 'Modification concurrente', version: 4 })
  await act(async () =>
    router.options.context.queryClient.invalidateQueries({
      queryKey: ['planning'],
    }),
  )
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Ce PTA a été modifié',
  )
  expect(within(dialog).getByLabelText('Nom du PTA *')).toHaveValue(
    'Mon brouillon',
  )
  expect(
    within(dialog).getByRole('button', { name: 'Enregistrer' }),
  ).toBeDisabled()
  const call = fetcher.mock.calls.find(([, o]) => o.method === 'PATCH')
  expect(JSON.parse(call[1].body).expected_version).toBe(3)
})

test('an empty active Project list explains why PTA creation is unavailable', async () => {
  setup({ projects: [] })
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Créer un PTA' }))
  expect(
    await screen.findByText(/Aucun projet actif n’est disponible/),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Créer le PTA' })).toBeDisabled()
})

test('a rejected write keeps its draft and does not deny the readable page', async () => {
  setup({
    existing: true,
    save: () =>
      new Response(JSON.stringify({ code: 'business_forbidden' }), {
        status: 403,
      }),
  })
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'Modifier le PTA' }),
  )
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Nom du PTA *'), {
    target: { value: 'Mon brouillon' },
  })
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Votre saisie a été conservée',
  )
  expect(within(dialog).getByLabelText('Nom du PTA *')).toHaveValue(
    'Mon brouillon',
  )
  expect(screen.queryByText('Accès refusé')).not.toBeInTheDocument()
})

test('a lost write response is reconciled against the saved PTA instead of reported as failure', async () => {
  let replace
  const { replacePTA } = setup({
    existing: true,
    save: () => {
      replace({ name: 'Nom enregistré', version: 4 })
      throw new TypeError('Connection lost')
    },
  })
  replace = replacePTA
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'Modifier le PTA' }),
  )
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Nom du PTA *'), {
    target: { value: 'Nom enregistré' },
  })
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(
    await screen.findByRole('heading', { name: 'Nom enregistré', level: 1 }),
  ).toBeVisible()
  expect(await screen.findByText('PTA modifié.')).toBeVisible()
})

test.each([403, 404])(
  'denied Project reads (%s) remove the options and dependent draft',
  async (status) => {
    let denied = false
    const { router } = setup({
      projectReply: () =>
        new Response(
          JSON.stringify(
            denied
              ? { code: 'business_forbidden' }
              : { ...empty, count: 1, data: [project] },
          ),
          { status: denied ? status : 200 },
        ),
    })
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: 'Créer un PTA' }),
    )
    fireEvent.change(screen.getByLabelText('Nom du PTA *'), {
      target: { value: 'Privé' },
    })
    denied = true
    await act(async () =>
      router.options.context.queryClient.invalidateQueries({
        queryKey: ['planning', 'reviewer', 'pta-project-options'],
      }),
    )
    await screen.findByText('Accès refusé')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      router.options.context.queryClient.getQueryData([
        'planning',
        'reviewer',
        'pta-project-options',
        '',
      ]),
    ).toBeUndefined()
  },
)

test('dismissing a submitted PTA edit lets it settle and refreshes the owning page', async () => {
  let finish
  const reply = new Promise((resolve) => {
    finish = resolve
  })
  const { replacePTA, fetcher } = setup({ existing: true, save: () => reply })
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'Modifier le PTA' }),
  )
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Nom du PTA *'), {
    target: { value: 'Enregistré après fermeture' },
  })
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(([, options]) => options.method === 'PATCH'),
    ).toBe(true),
  )
  fireEvent.keyDown(dialog, { key: 'Escape' })
  fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  const call = fetcher.mock.calls.find(
    ([, options]) => options.method === 'PATCH',
  )
  expect(call[1].signal.aborted).toBe(false)
  replacePTA({ name: 'Enregistré après fermeture', version: 4 })
  await act(async () =>
    finish(
      new Response(
        JSON.stringify({ id: 'pta-1', project_id: project.id, year: 2027 }),
        { status: 200 },
      ),
    ),
  )
  expect(
    await screen.findByRole('heading', {
      name: 'Enregistré après fermeture',
      level: 1,
    }),
  ).toBeVisible()
})
