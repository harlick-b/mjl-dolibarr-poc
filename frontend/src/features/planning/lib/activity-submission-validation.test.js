import { describe, expect, it } from 'vitest'
import { activitySubmissionProblems } from './activity-submission-validation'

const completeTask = {
  name: 'Préparer la session',
  type_id: 'category-1',
  allocation: '100000',
  weight: '100',
  planned_start: '2027-01-10',
  planned_end: '2027-01-20',
  subtasks: [],
}

describe('Activity submission validation', () => {
  it('accepts one complete Activity programming contract', () => {
    expect(
      activitySubmissionProblems({
        name: 'Formation',
        start: '2027-01-01',
        end: '2027-01-31',
        amount: '100000',
        tasks: [completeTask],
      }),
    ).toEqual([])
  })

  it('reports the same nested allocation and required-field problems to every submit surface', () => {
    const problems = activitySubmissionProblems({
      name: 'Formation',
      start: '2027-01-01',
      end: '2027-01-31',
      amount: '100000',
      tasks: [
        {
          ...completeTask,
          type_id: null,
          weight: '90',
          subtasks: [
            {
              name: 'Invitations',
              allocation: '90000',
              weight: '80',
              planned_start: null,
              planned_end: null,
            },
          ],
        },
      ],
    })

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('catégorie'),
        expect.stringContaining('100 %'),
        expect.stringContaining('total des sous-tâches'),
        expect.stringContaining('dates prévues'),
      ]),
    )
  })

  it('reports missing Task and Subtask names and non-positive planned amounts', () => {
    const problems = activitySubmissionProblems({
      name: 'Formation',
      start: '2027-01-01',
      end: '2027-01-31',
      amount: '100000',
      tasks: [
        {
          ...completeTask,
          name: '',
          subtasks: [
            {
              name: '',
              allocation: '0',
              weight: '50',
              planned_start: '2027-01-10',
              planned_end: '2027-01-15',
            },
            {
              name: 'Animation',
              allocation: '100000',
              weight: '50',
              planned_start: '2027-01-16',
              planned_end: '2027-01-20',
            },
          ],
        },
      ],
    })

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('intitulé de la tâche'),
        expect.stringContaining('intitulé de la sous-tâche'),
        expect.stringContaining('montant prévu positif'),
      ]),
    )
  })
})
