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
          actor: { full_name: 'Validateur' },
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
          ],
          facts: [],
        },
      ]}
    />,
  )
  expect(screen.getByText('Étape majeure')).toBeVisible()
  expect(screen.getByText('Modification')).toBeVisible()
  expect(screen.getByText('Préciser le calendrier')).not.toBeVisible()
  await userEvent.click(screen.getAllByText('Consulter les détails')[0])
  expect(screen.getByText('Préciser le calendrier')).toBeVisible()
  await userEvent.click(screen.getAllByText('Consulter les détails')[1])
  expect(screen.getByText(/9007199254740993 → 9007199254740994/)).toBeVisible()
  await userEvent.click(
    screen.getByRole('button', { name: 'Consulter la révision' }),
  )
  expect(navigate.mock.calls[0][0].search({ revisionCursor: 'page' })).toEqual({
    revisionCursor: 'page',
    revision: 'revision-1',
    amendment: undefined,
  })
})
