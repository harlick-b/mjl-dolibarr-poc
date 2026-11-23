import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { expect, test, vi } from 'vitest'
import { App, makeRouter } from './router'

test.each(['saved', 'absent'])(
  'an uncertain upload waits for %s reconciliation before another attempt',
  async (outcome) => {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
    const user = userEvent.setup()
    const activity = {
      id: 'activity-upload',
      project_id: 'project-1',
      name: 'Justificatifs',
      reference: 'ACT-1',
      state: 'draft',
      version: 1,
      planned_start: '2027-01-01',
      planned_end: '2027-04-01',
      allocation: '100',
      operations: [],
      agent_ids: ['agent'],
      allowed_actions: ['read'],
    }
    const empty = {
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }
    const existingDocument = {
      id: 'doc-existing',
      activity_id: 'activity-upload',
      name: 'preuve.png',
      media_type: 'image/png',
      size: 3,
      uploaded_by_id: 'agent',
      uploaded_at: '2027-01-01T00:00:00Z',
      withdrawal: null,
      partner_shared: false,
      sharing_version: 1,
      allowed_actions: [],
    }
    const existingPage = {
      ...empty,
      count: 1,
      data: [existingDocument],
    }
    const unmatchedPage = {
      ...empty,
      count: 2,
      data: [
        existingDocument,
        {
          ...existingDocument,
          id: 'doc-other-user',
          uploaded_by_id: 'another-agent',
        },
      ],
    }
    let uploads = 0
    let finishRead
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        const path = String(url)
        if (path.endsWith('/documents') && options.method === 'POST') {
          uploads += 1
          throw new TypeError('Response lost after commit')
        }
        if (path.endsWith('/documents') && uploads)
          return new Promise((resolve) => {
            finishRead = resolve
          })
        if (path.endsWith('/documents'))
          return new Response(JSON.stringify(existingPage))
        let body = empty
        if (path.includes('/auth/session'))
          body = {
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }
        else if (path.endsWith('/activities/activity-upload')) body = activity
        return new Response(JSON.stringify(body))
      }),
    )
    render(
      <App
        router={makeRouter(
          createMemoryHistory({
            initialEntries: ['/planning/activities/activity-upload#files'],
          }),
        )}
      />,
    )
    await user.click(
      await screen.findByRole('button', { name: 'Ajouter une pièce' }),
    )
    await user.upload(
      screen.getByLabelText('Choisir un fichier PDF, JPEG ou PNG *'),
      new File(['png'], 'preuve.png', { type: 'image/png' }),
    )
    fireEvent.submit(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Ajouter',
      }).form,
    )
    await waitFor(() => expect(finishRead).toBeDefined())
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Ajouter',
      }),
    ).toBeDisabled()
    await act(async () =>
      finishRead(
        new Response(
          JSON.stringify(
            outcome === 'saved'
              ? {
                  ...empty,
                  count: 2,
                  data: [
                    existingDocument,
                    {
                      ...existingDocument,
                      id: 'doc-1',
                    },
                  ],
                }
              : { code: 'service_unavailable' },
          ),
          { status: outcome === 'saved' ? 200 : 503 },
        ),
      ),
    )
    expect(uploads).toBe(1)
    if (outcome === 'saved') {
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      )
      expect(
        screen.getAllByRole('button', { name: 'Aperçu de preuve.png' }),
      ).toHaveLength(2)
    } else {
      expect(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Ajouter',
        }),
      ).toBeDisabled()
      expect(
        await within(screen.getByRole('dialog')).findByRole('button', {
          name: 'Vérifier les pièces jointes',
        }),
      ).toBeEnabled()
      fireEvent.click(
        screen.getByRole('button', { name: 'Vérifier les pièces jointes' }),
      )
      await act(async () =>
        finishRead(new Response(JSON.stringify(unmatchedPage))),
      )
      await waitFor(() =>
        expect(
          within(screen.getByRole('dialog')).getByRole('button', {
            name: 'Ajouter',
          }),
        ).toBeEnabled(),
      )
      expect(screen.getByRole('dialog')).toBeVisible()
      expect(uploads).toBe(1)
    }
  },
)
