import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelmetProvider } from 'react-helmet-async'
import { expect, test, vi } from 'vitest'
import { PageLoading } from './PageLoading'
import { RetryableError } from './RetryableError'

test('page loading uses the minimal loader without page-shaped placeholders', () => {
  const { container } = render(
    <HelmetProvider>
      <PageLoading title="Projets" />
    </HelmetProvider>,
  )

  expect(
    screen.getByRole('status', { name: 'Chargement : Projets' }),
  ).toHaveTextContent('Chargement des données…')
  expect(container.querySelector('[data-ui~="loading-placeholder"]')).toBeNull()
})

test('a local read failure stays in its section and retries deliberately', async () => {
  const retry = vi.fn()
  render(
    <RetryableError onRetry={retry}>
      Les activités sont momentanément indisponibles.
    </RetryableError>,
  )

  const alert = screen.getByRole('alert')
  expect(
    screen.getByRole('heading', {
      level: 2,
      name: 'Impossible de charger les données',
    }),
  ).toBeVisible()
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  expect(alert).toHaveTextContent('Impossible de charger les données')
  expect(alert).toHaveTextContent(
    'Les activités sont momentanément indisponibles.',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  expect(retry).toHaveBeenCalledOnce()
})

test('a page failure remains the page heading', () => {
  render(
    <RetryableError page onRetry={() => {}}>
      La page est momentanément indisponible.
    </RetryableError>,
  )

  expect(
    screen.getByRole('heading', { level: 1, name: 'Service indisponible' }),
  ).toBeVisible()
})
