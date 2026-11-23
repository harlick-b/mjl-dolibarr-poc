import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ActivityTimeline } from './ActivityTimeline'
import { formatActivityAuditValue, formatAuditValue } from './auditPresentation'

test('activity history renders a flat administrative register with natural attribution', () => {
  const { container } = render(
    <ActivityTimeline
      events={[
        {
          id: 6,
          action: 'reversement.declared',
          label: 'Reversement déclaré',
          occurred_at: '2026-11-06T13:00:00Z',
          actor: { full_name: 'Aïcha Agent' },
          changes: [],
          facts: [],
        },
        {
          id: 5,
          action: 'activity.approve',
          label: 'Activité approuvée',
          occurred_at: '2026-11-06T12:00:00Z',
          actor: { full_name: 'Clarisse Akpon' },
          changes: [],
          facts: [],
        },
        {
          id: 4,
          action: 'activity.prevalidate',
          label: 'Activité prévalidée',
          occurred_at: '2026-11-06T11:00:00Z',
          actor: { full_name: 'Jean Dossou' },
          changes: [],
          facts: [],
        },
        {
          id: 3,
          action: 'activity.closed',
          label: 'Activité clôturée',
          occurred_at: '2026-11-06T10:00:00Z',
          actor: {
            full_name: 'Clarisse Akpon',
            role: 'Validateur définitif',
          },
          changes: [],
          facts: [],
        },
        {
          id: 2,
          action: 'disbursement.approved',
          label: 'Décaissement autorisé',
          occurred_at: '2026-11-06T09:00:00Z',
          actor: { full_name: 'Jean Dossou', role: 'Superviseur' },
          changes: [],
          facts: [
            { field: 'Montant (F CFA)', before: null, after: '1000000' },
            {
              field: 'Budget approuvé (F CFA)',
              before: null,
              after: '2000000',
            },
          ],
        },
        {
          id: 1,
          action: 'activity.submit',
          label: 'Activité soumise',
          occurred_at: '2026-11-06T08:00:00Z',
          actor: { full_name: 'Aïcha Agent', role: 'Agent de saisie' },
          changes: [],
          facts: [],
        },
      ]}
    />,
  )

  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(6)
  expect(rows[0]).toHaveTextContent('Déclaré par Aïcha Agent')
  expect(rows[1]).toHaveTextContent('Validé par Clarisse Akpon')
  expect(rows[2]).toHaveTextContent('Prévalidé par Jean Dossou')
  expect(rows[3]).toHaveTextContent('Activité clôturée')
  expect(rows[3]).toHaveTextContent('Clôturé par Clarisse Akpon')
  expect(rows[4]).toHaveTextContent('Autorisé par Jean Dossou')
  expect(within(rows[4]).getByText('Montant autorisé :')).toBeVisible()
  expect(within(rows[4]).getByText('1 000 000 F CFA')).toBeVisible()
  expect(rows[5]).toHaveTextContent('Soumis par Aïcha Agent')
  expect(container.textContent).not.toContain('·')
  expect(container.textContent).not.toContain('→')
})

test('activity history recognizes transfer corrections without changing global formatting', () => {
  render(
    <ActivityTimeline
      events={[
        {
          id: 1,
          action: 'activity.transfer_return_supervisor',
          label: 'Transfert retourné par le superviseur',
          occurred_at: '2026-11-06T08:00:00Z',
          actor: { full_name: 'Jean Dossou' },
          reason: 'Revoir la date du transfert.',
          changes: [],
          facts: [],
        },
      ]}
    />,
  )

  expect(screen.getByText('Retour demandé par Jean Dossou')).toBeVisible()
  expect(screen.getByText('Motif du retour')).toBeVisible()
  expect(screen.getByText('Revoir la date du transfert.')).toBeVisible()

  const prefixedDateField = 'Tâche Formation · Date du virement'
  expect(formatAuditValue('2026-10-27', prefixedDateField)).toBe('2026-10-27')
  expect(formatActivityAuditValue('2026-10-27', prefixedDateField)).toBe(
    '27 octobre 2026',
  )
})

test('activity history preserves correction reasons and aligns meaningful changes', () => {
  render(
    <ActivityTimeline
      events={[
        {
          id: 2,
          action: 'activity.return_validator',
          label: 'Activité retournée par le validateur',
          occurred_at: '2026-11-06T09:00:00Z',
          actor: { full_name: 'Clarisse Akpon' },
          reason: 'Corriger le budget.\nConserver les dates.',
          changes: [{ field: 'État', before: 'submitted', after: 'returned' }],
          facts: [],
        },
        {
          id: 1,
          action: 'activity.replace',
          label: 'Brouillon d’activité modifié',
          occurred_at: '2026-11-06T08:00:00Z',
          actor: { full_name: 'Aïcha Agent' },
          changes: [
            {
              field: 'Budget (F CFA)',
              before: '9007199254740993',
              after: '9007199254740994',
            },
            {
              field: 'Tâche Formation · Date du virement',
              before: '2026-10-27',
              after: '2026-10-28',
            },
          ],
          facts: [],
        },
      ]}
    />,
  )

  const correction = screen.getByText('Motif du retour').closest('div')
  expect(correction).toHaveTextContent(
    'Corriger le budget. Conserver les dates.',
  )
  expect(correction.querySelector('p')).toHaveTextContent(
    'Corriger le budget. Conserver les dates.',
  )
  expect(correction.querySelector('p').textContent).toBe(
    'Corriger le budget.\nConserver les dates.',
  )
  expect(screen.getByText('Retour demandé par Clarisse Akpon')).toBeVisible()
  expect(screen.queryByText('État')).not.toBeInTheDocument()

  const budget = screen.getByText('Budget').closest('div')
  expect(within(budget).getByText('Avant')).toBeVisible()
  expect(within(budget).getByText('Après')).toBeVisible()
  expect(within(budget).getByText('9 007 199 254 740 993 F CFA')).toBeVisible()
  expect(within(budget).getByText('9 007 199 254 740 994 F CFA')).toBeVisible()
  expect(screen.getByText('Tâche Formation, Date du virement')).toBeVisible()
  expect(screen.getByText('27 octobre 2026')).toBeVisible()
  expect(screen.getByText('28 octobre 2026')).toBeVisible()
})

test('activity history renders the events selected by its page owner', () => {
  render(
    <ActivityTimeline
      events={[
        {
          id: 3,
          action: 'activity.replace',
          label: 'Brouillon d’activité modifié',
          occurred_at: '2026-11-06T10:00:00Z',
          actor: { full_name: 'Aïcha Agent' },
          changes: [],
          facts: [],
        },
        {
          id: 2,
          action: 'activity.create',
          label: 'Activité créée',
          occurred_at: '2026-11-06T09:00:00Z',
          actor: null,
          changes: [],
          facts: [{ field: 'Montant (F CFA)', before: null, after: null }],
        },
      ]}
    />,
  )

  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByText('Activité créée')).toBeVisible()
  expect(screen.getByText('Brouillon d’activité modifié')).toBeVisible()
  expect(screen.queryByText(/Système/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Non renseigné/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Ouvrir la demande/)).not.toBeInTheDocument()
})

test('activity history presents initial financial records directly without duplicates', () => {
  render(
    <ActivityTimeline
      events={[
        {
          id: 2,
          action: 'virement_confirmation.declared',
          label: 'Virement externe confirmé',
          occurred_at: '2026-11-06T10:00:00Z',
          actor: { full_name: 'Aïcha Agent' },
          facts: [{ field: 'Montant (F CFA)', before: null, after: '1000000' }],
          changes: [
            { field: 'Montant (F CFA)', before: null, after: '1000000' },
            {
              field: 'Date du virement',
              before: null,
              after: '2026-11-05',
            },
            { field: 'Note', before: null, after: 'Référence bancaire 42' },
          ],
        },
        {
          id: 1,
          action: 'reversement.declared',
          label: 'Reversement déclaré',
          occurred_at: '2026-11-06T09:00:00Z',
          actor: { full_name: 'Aïcha Agent' },
          facts: [
            {
              field: 'Reversement requis (F CFA)',
              before: null,
              after: '250000',
            },
            {
              field: 'Montant reversé (F CFA)',
              before: null,
              after: '250000',
            },
          ],
          changes: [
            { field: 'Montant (F CFA)', before: null, after: '250000' },
            {
              field: 'Date du reversement',
              before: null,
              after: '2026-11-06',
            },
          ],
        },
      ]}
    />,
  )

  const rows = screen.getAllByRole('listitem')
  expect(within(rows[0]).getAllByText('1 000 000 F CFA')).toHaveLength(1)
  expect(within(rows[0]).getByText('Montant viré :')).toBeVisible()
  expect(
    within(rows[0]).getByText('Date effective du virement :'),
  ).toBeVisible()
  expect(within(rows[0]).getByText('5 novembre 2026')).toBeVisible()
  expect(within(rows[0]).queryByText('Après')).not.toBeInTheDocument()
  expect(within(rows[1]).getAllByText('250 000 F CFA')).toHaveLength(1)
  expect(within(rows[1]).getByText('Montant reversé :')).toBeVisible()
  expect(
    within(rows[1]).queryByText('Reversement requis :'),
  ).not.toBeInTheDocument()
})

test('activity history compares genuine corrections and omits unchanged context', () => {
  render(
    <ActivityTimeline
      events={[
        {
          id: 2,
          action: 'virement_confirmation.corrected',
          label: 'Virement externe corrigé',
          occurred_at: '2026-11-06T10:00:00Z',
          actor: { full_name: 'Aïcha Agent' },
          facts: [{ field: 'Montant (F CFA)', before: null, after: '900000' }],
          changes: [
            { field: 'Montant (F CFA)', before: '800000', after: '900000' },
            {
              field: 'Date du virement',
              before: '2026-11-04',
              after: '2026-11-05',
            },
          ],
        },
        {
          id: 1,
          action: 'operation.execution_corrected',
          label: 'Réalisation modifiée',
          occurred_at: '2026-11-06T09:00:00Z',
          actor: { full_name: 'Aïcha Agent' },
          facts: [
            {
              field: 'Budget approuvé (F CFA)',
              before: null,
              after: '1000000',
            },
          ],
          changes: [
            { field: 'Dépenses (F CFA)', before: '600000', after: '700000' },
            {
              field: 'Observation',
              before: 'Première saisie',
              after: 'Facture finale reçue',
            },
          ],
        },
      ]}
    />,
  )

  const rows = screen.getAllByRole('listitem')
  expect(within(rows[0]).getByText('Information')).toBeVisible()
  expect(within(rows[0]).getByText('Avant')).toBeVisible()
  expect(within(rows[0]).getByText('Après')).toBeVisible()
  expect(within(rows[0]).getAllByText('900 000 F CFA')).toHaveLength(1)
  expect(within(rows[1]).queryByText('Budget approuvé')).not.toBeInTheDocument()
  expect(within(rows[1]).getByText('Dépenses enregistrées')).toBeVisible()
  expect(within(rows[1]).getByText('600 000 F CFA')).toBeVisible()
  expect(within(rows[1]).getByText('700 000 F CFA')).toBeVisible()
})

test('activity history preserves one-sided programming changes without inventing an initial record', () => {
  render(
    <ActivityTimeline
      events={[
        {
          id: 1,
          action: 'activity.replace',
          label: 'Brouillon d’activité modifié',
          occurred_at: '2026-11-06T08:00:00Z',
          actor: { full_name: 'Aïcha Agent' },
          facts: [],
          changes: [
            {
              field: 'Tâche Formation · Description',
              before: null,
              after: 'Préparer les supports',
            },
            {
              field: 'Observation',
              before: 'À retirer',
              after: null,
            },
          ],
        },
      ]}
    />,
  )

  const row = screen.getByRole('listitem')
  expect(row).toHaveTextContent('Brouillon d’activité modifié')
  expect(within(row).getByText('Tâche Formation, Description :')).toBeVisible()
  expect(within(row).getByText('Préparer les supports')).toBeVisible()
  expect(within(row).getByText('Observation')).toBeVisible()
  expect(within(row).getByText('À retirer')).toBeVisible()
  expect(within(row).getByText('Supprimé')).toBeVisible()
})

test('activity history uses natural Task and Subtask labels', () => {
  render(
    <ActivityTimeline
      events={[
        {
          id: 1,
          action: 'activity.replace',
          label: 'Brouillon d’activité modifié',
          occurred_at: '2026-11-06T08:00:00Z',
          actor: { full_name: 'Aïcha Agent' },
          facts: [],
          changes: [
            {
              field: 'Tâche Task #2 · Nom',
              before: 'Ancien intitulé',
              after: 'Nouvel intitulé',
            },
            {
              field: 'Sous-tâche indisponible · Description',
              before: null,
              after: 'Préparer les badges',
            },
          ],
        },
      ]}
    />,
  )

  const row = screen.getByRole('listitem')
  expect(within(row).getByText('Intitulé de la tâche')).toBeVisible()
  expect(
    within(row).getByText('Sous-tâche non identifiée, Description :'),
  ).toBeVisible()
  expect(row).not.toHaveTextContent('Tâche Task #2')
})
