import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ActivityTimeline } from './ActivityTimeline'

test('timeline shows milestones, persisted changes, reasons and revision links', async () => {
  const navigate = vi.fn()
  render(
    <ActivityTimeline
      navigate={navigate}
      events={[
        {
          id: 2,
          label: 'Activité retournée',
          occurred_at: '2026-11-06T09:00:00Z',
          milestone: true,
          actor: {
            full_name: 'Clarisse Akpon',
            role: 'Validateur définitif',
          },
          revision_id: 'revision-1',
          reason: 'Préciser le calendrier',
          changes: [],
          facts: [],
        },
        {
          id: 1,
          label: 'Brouillon modifié',
          occurred_at: '2026-11-06T08:00:00Z',
          milestone: false,
          actor: { full_name: 'Agent' },
          changes: [
            {
              field: 'Budget (F CFA)',
              before: '9007199254740993',
              after: '9007199254740994',
            },
            {
              field: 'Date du virement',
              before: '2026-10-27',
              after: '2026-10-28',
            },
          ],
          facts: [
            {
              field: 'Début de réalisation',
              after: '2026-11-06T08:00:00Z',
            },
          ],
        },
      ]}
    />,
  )
  expect(
    screen.getByText(/Clarisse Akpon · Validateur définitif/),
  ).toBeVisible()
  expect(screen.getByText('Préciser le calendrier')).toBeVisible()
  expect(screen.getByText(/Budget \(F CFA\)/).closest('p')).toHaveTextContent(
    '9 007 199 254 740 993 F CFA → 9 007 199 254 740 994 F CFA',
  )
  expect(screen.getByText(/27 octobre 2026 → 28 octobre 2026/)).toBeVisible()
  expect(screen.getByText(/6 novembre 2026 à 09:00/)).toBeVisible()
  await userEvent.click(
    screen.getByRole('button', { name: 'Voir les informations soumises' }),
  )
  expect(navigate.mock.calls[0][0].search({ revisionCursor: 'page' })).toEqual({
    revisionCursor: 'page',
    revision: 'revision-1',
    amendment: undefined,
  })
})
