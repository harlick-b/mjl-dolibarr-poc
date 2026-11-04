import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router'

afterEach(() => vi.unstubAllGlobals())

test('the sidebar notification centre marks a reminder read and refreshes its badge', async () => {
  let read = false
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: { id: 'agent', role: 'AGENT_SAISIE' },
          }),
        ),
      )
    if (path.includes('/notifications/') && options.method === 'PATCH') {
      read = true
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'notice-1',
            activity_id: 'activity-1',
            activity_reference: 'ACT-001',
            activity_name: 'Formation',
            planned_end: '2028-02-29',
            due_on: '2028-02-08',
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
            id: 'notice-1',
            activity_id: 'activity-1',
            activity_reference: 'ACT-001',
            activity_name: 'Formation',
            planned_end: '2028-02-29',
            due_on: '2028-02-08',
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
  expect(screen.getByLabelText('1 non lues')).toBeVisible()
  const online = vi.spyOn(window.navigator, 'onLine', 'get')
  online.mockReturnValue(false)
  await userEvent.click(
    screen.getByRole('button', { name: /Marquer comme lue/ }),
  )
  expect(
    fetch.mock.calls.some(([, options]) => options?.method === 'PATCH'),
  ).toBe(false)
  expect(screen.getByText(/ACT-001/)).toBeVisible()
  online.mockReturnValue(true)
  await userEvent.click(
    screen.getByRole('button', { name: /Marquer comme lue/ }),
  )
  await waitFor(() =>
    expect(screen.queryByText(/ACT-001/)).not.toBeInTheDocument(),
  )
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/notifications/notice-1',
    expect.objectContaining({ method: 'PATCH' }),
  )
})
