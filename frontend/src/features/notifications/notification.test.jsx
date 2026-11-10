import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router'

afterEach(() => vi.unstubAllGlobals())

test('an assignment notification is readable and uses the standard read flow', async () => {
  let read = false
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
    if (path.includes('/notifications/') && options.method === 'PATCH') {
      read = true
      return Promise.resolve(
        new Response(
          JSON.stringify({
            kind: 'assignment',
            id: 'notice-1',
            activity_id: 'activity-1',
            activity_reference: 'ACT-001',
            activity_name: 'Formation',
            planned_end: '2028-02-29',
            due_on: '2028-02-08',
            pta_name: 'PTA Protection',
            project_name: 'Protection de l’enfant',
            assigned_by: 'Yoann Validateur',
            created_at: '2028-02-08T08:00:00Z',
            read_at: '2028-02-08T09:00:00Z',
            email_status: 'delivered',
            version: 2,
          }),
        ),
      )
    }
    const data = read
      ? []
      : [
          {
            kind: 'assignment',
            id: 'notice-1',
            activity_id: 'activity-1',
            activity_reference: 'ACT-001',
            activity_name: 'Formation',
            planned_end: '2028-02-29',
            due_on: '2028-02-08',
            pta_name: 'PTA Protection',
            project_name: 'Protection de l’enfant',
            assigned_by: 'Yoann Validateur',
            created_at: '2028-02-08T08:00:00Z',
            read_at: null,
            email_status: 'delivered',
            version: 1,
          },
        ]
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
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeRouter(
        createMemoryHistory({ initialEntries: ['/notifications'] }),
      )}
    />,
  )

  await screen.findByText(/ACT-001/)
  expect(screen.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  expect(await screen.findByText(/ACT-001/)).toBeVisible()
  expect(screen.getByText('Nouvelle activité assignée')).toBeVisible()
  expect(
    screen.getByText(
      'Yoann Validateur vous a assigné cette activité dans PTA Protection - Protection de l’enfant.',
    ),
  ).toBeVisible()
  expect(screen.getByLabelText('1 non lues')).toBeVisible()
  await userEvent.click(screen.getByRole('link', { name: /Ouvrir l’activité/ }))
  await waitFor(() =>
    expect(screen.queryByText(/ACT-001/)).not.toBeInTheDocument(),
  )
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/notifications/notice-1',
    expect.objectContaining({ method: 'PATCH' }),
  )
})

test('a Supervisor sees a review notification in the shared inbox', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
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
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: [
              {
                kind: 'activity_review',
                stage: 'supervisor',
                id: 'notice-review-1',
                activity_id: 'activity-1',
                activity_reference: 'ACT-001',
                activity_name: 'Formation',
                pta_year: 2028,
                created_at: '2028-02-08T08:00:00Z',
                read_at: null,
                handled_at: null,
                email_status: 'delivered',
                version: 1,
              },
              {
                kind: 'financial_review',
                stage: 'supervisor',
                request_kind: 'virement',
                request_id: 'request-1',
                id: 'notice-financial-1',
                activity_id: 'activity-1',
                activity_reference: 'ACT-001',
                activity_name: 'Formation',
                pta_year: 2028,
                created_at: '2028-02-08T09:00:00Z',
                read_at: null,
                handled_at: null,
                email_status: 'delivered',
                version: 1,
              },
            ],
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
        createMemoryHistory({ initialEntries: ['/notifications'] }),
      )}
    />,
  )
  expect(await screen.findByText('Activité à examiner')).toBeVisible()
  expect(screen.getByText('Demande à examiner')).toBeVisible()
  expect(
    screen.getByText('La demande de virement attend votre examen.'),
  ).toBeVisible()
  expect(screen.getAllByText('Formation')).toHaveLength(2)
  expect(
    screen.getAllByRole('link', { name: /Ouvrir l’activité/ })[1],
  ).toHaveAttribute('href', '/execution/activities/activity-1')
  expect(screen.getByLabelText('2 non lues')).toBeVisible()
})
