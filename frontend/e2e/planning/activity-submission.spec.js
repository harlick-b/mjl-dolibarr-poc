import { test, expect } from '@playwright/test'
import {
  acceptInvitation,
  api,
  checkConnectedPlanningEnvironment,
  clearSharedIpBucket,
  preparePlanningContext,
} from '../support/connected-planning'

function validationSummary(page) {
  return page.getByRole('complementary').filter({
    has: page.getByRole('heading', { name: 'Budget et validation' }),
  })
}

test('an assigned Agent submits an Activity for Supervisor review', async ({
  page,
  browser,
}) => {
  test.skip(
    !checkConnectedPlanningEnvironment(),
    'Requires an isolated connected planning environment',
  )
  test.setTimeout(180000)
  preparePlanningContext()

  await acceptInvitation(page, 'submission-admin@example.test')
  for (const [email, role] of [
    ['submission-validator@example.test', 'VALIDATEUR_DEFINITIF'],
    ['submission-agent@example.test', 'AGENT_SAISIE'],
    ['submission-supervisor@example.test', 'AGENT_VERIFICATEUR'],
  ]) {
    const invitation = await api(page, '/access/invitations', 'POST', {
      email,
      full_name: email.split('@')[0],
      role,
    })
    expect(invitation.status).toBe(201)
  }

  const validatorContext = await browser.newContext()
  const validator = await validatorContext.newPage()
  await acceptInvitation(validator, 'submission-validator@example.test')
  const partner = await api(validator, '/partners', 'POST', {
    name: 'Partenaire soumission connectée',
  })
  expect(partner.status).toBe(201)
  const category = await api(validator, '/task-categories', 'POST', {
    label: 'Atelier connecté',
  })
  expect(category.status).toBe(201)
  const project = await api(validator, '/projects', 'POST', {
    partner_id: partner.body.id,
    name: 'Projet soumission connectée',
  })
  expect(project.status).toBe(201)
  const pta = await api(
    validator,
    `/projects/${project.body.id}/ptas`,
    'POST',
    { year: 2027, name: 'PTA soumission connectée' },
  )
  expect(pta.status).toBe(201)

  const agentContext = await browser.newContext()
  const agent = await agentContext.newPage()
  await acceptInvitation(agent, 'submission-agent@example.test')
  const activity = await api(
    agent,
    `/projects/${project.body.id}/ptas/2027/activities`,
    'POST',
    {
      request_key: crypto.randomUUID(),
      name: 'Activité soumission connectée',
      description: 'Plan complet prêt pour la prévalidation',
      planned_start: '2027-04-01',
      planned_end: '2027-06-30',
      allocation: '300000',
      tasks: [
        {
          type_id: category.body.id,
          name: 'Préparer l’atelier connecté',
          description: '',
          allocation: '300000',
          weight: '100.00',
          planned_start: '2027-04-01',
          planned_end: '2027-06-30',
          subtasks: [],
        },
      ],
    },
  )
  expect(activity.status).toBe(201)

  const supervisorContext = await browser.newContext()
  const supervisor = await supervisorContext.newPage()
  await acceptInvitation(supervisor, 'submission-supervisor@example.test')

  clearSharedIpBucket()
  await agent.goto(`/activities/${activity.body.id}`)
  await agent
    .getByRole('button', { name: 'Soumettre pour prévalidation' })
    .click()
  await agent
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmer' })
    .click()
  await expect(validationSummary(agent)).toContainText(
    'Soumise pour prévalidation',
  )
  await expect(
    agent.getByRole('button', { name: 'Soumettre pour prévalidation' }),
  ).toHaveCount(0)

  clearSharedIpBucket()
  await supervisor.goto(`/activities/${activity.body.id}`)
  await expect(
    supervisor.getByRole('heading', { name: 'Activité soumission connectée' }),
  ).toBeVisible()
  await expect(validationSummary(supervisor)).toContainText(
    'Soumise pour prévalidation',
  )
  await expect(
    validationSummary(supervisor).getByText(/300[\s\u202f]?000 F CFA/),
  ).toBeVisible()
  await expect(
    supervisor.getByRole('button', { name: 'Prévalider' }),
  ).toBeVisible()
  const reviewerDetail = await api(
    supervisor,
    `/activities/${activity.body.id}`,
  )
  expect(reviewerDetail.status).toBe(200)
  expect(reviewerDetail.body.state).toBe('submitted')
  expect(reviewerDetail.body.current_revision_number).toBe(1)
  const revisions = await api(
    supervisor,
    `/activities/${activity.body.id}/revisions`,
  )
  expect(revisions.status).toBe(200)
  expect(revisions.body.data).toHaveLength(1)
  const revision = await api(
    supervisor,
    `/activities/${activity.body.id}/revisions/${revisions.body.data[0].id}`,
  )
  expect(revision.status).toBe(200)
  expect(revision.body.snapshot.name).toBe('Activité soumission connectée')
  expect(revision.body.snapshot.allocation).toBe('300000')

  await supervisorContext.close()
  await agentContext.close()
  await validatorContext.close()
})
