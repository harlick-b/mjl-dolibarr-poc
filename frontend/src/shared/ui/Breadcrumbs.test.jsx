import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { Breadcrumbs } from './Breadcrumbs'

test('renders Router links and marks the current page', async () => {
  const rootRoute = createRootRoute({
    component: () => (
      <Breadcrumbs
        label="Fil d’Ariane"
        items={[{ label: 'Prévisions', to: '/' }, { label: 'Activité' }]}
      />
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  expect(screen.getByRole('link', { name: 'Prévisions' })).toHaveAttribute(
    'href',
    '/',
  )
  expect(screen.getByText('Activité')).toHaveAttribute('aria-current', 'page')
})
