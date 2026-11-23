import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { CorrectionNotice } from './CorrectionNotice'

test('shows an attributed multiline correction without rewriting it', () => {
  render(
    <CorrectionNotice
      title="Programmation retournée pour correction"
      correction={{
        actor_name: 'Clarisse AKPON',
        actor_role: 'VALIDATEUR_DEFINITIF',
        decided_at: '2026-08-07T15:20:00+01:00',
        reason:
          'Préciser les communes couvertes.\n\nDistinguer les frais de mobilisation.',
      }}
    />,
  )

  const notice = screen.getByRole('status', {
    name: 'Programmation retournée pour correction',
  })
  expect(notice).toHaveTextContent(
    'Retour demandé par Clarisse AKPON (Validateur définitif) le 7 août 2026 à 15:20.',
  )
  const reason = screen.getByText(/Préciser les communes couvertes/)
  expect(reason).toHaveTextContent(
    'Préciser les communes couvertes. Distinguer les frais de mobilisation.',
  )
  expect(reason.textContent).toBe(
    'Préciser les communes couvertes.\n\nDistinguer les frais de mobilisation.',
  )
})

test('omits unavailable reviewer metadata', () => {
  render(
    <CorrectionNotice
      title="Demande retournée pour correction"
      correction={{ reason: 'Compléter le dossier.' }}
    />,
  )

  expect(screen.queryByText(/Retour demandé/)).not.toBeInTheDocument()
  expect(screen.getByText('Compléter le dossier.')).toBeVisible()
})
