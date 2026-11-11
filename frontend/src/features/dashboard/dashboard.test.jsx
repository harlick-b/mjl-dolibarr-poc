import { render, screen, within } from '@testing-library/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router'

test('dashboard attention titles and actions link to their activity workflow', async () => {
  const list = (data) => ({
    object: 'list',
    count: data.length,
    data,
    next: null,
    previous: null,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = new URL(url, window.location.origin).pathname
      let body
      if (path.endsWith('/auth/session'))
        body = {
          state: 'verified',
          csrf: 'fixture',
          user: {
            id: 'agent',
            role: 'AGENT_SAISIE',
            email: 'agent@example.test',
          },
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }
      else if (path === '/api/v1/projects')
        body = list([{ id: 'project', name: 'Projet' }])
      else if (path === '/api/v1/projects/project/ptas')
        body = list([{ id: 'pta', year: 2026 }])
      else if (path === '/api/v1/ptas/pta/dashboard')
        body = {
          physical: { closed_activities: 0, approved_activities: 0 },
          financial: { closed_spending: '0', approved_allocation: '0' },
          finance: { approved_operations: 0, recorded_operations: 0 },
          attention: {
            count: 2,
            items: [
              {
                activity_id: 'planning-id',
                name: 'Activité à préparer',
                destination: 'planning',
                reason: 'draft_to_complete',
                action: 'edit',
              },
              {
                activity_id: 'execution-id',
                name: 'Activité à réaliser',
                destination: 'execution',
                reason: 'reversement_required',
                action: 'view',
              },
            ],
          },
        }
      else body = list([])
      return new Response(JSON.stringify(body))
    }),
  )
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/dashboard'] }),
      )}
    />,
  )
  for (const [name, href] of [
    ['Activité à préparer', '/activities/planning-id'],
    ['Activité à réaliser', '/execution/activities/execution-id'],
  ]) {
    const title = await screen.findByRole('link', { name })
    const links = within(title.closest('li')).getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute('href', href)
  }
})
