import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { AgentSearchPanel } from './AgentSearchPanel'

test('Agent search keeps status outside its list and shares keyboard navigation', async () => {
  const user = userEvent.setup()
  render(
    <AgentSearchPanel
      title="Agent affecté"
      searchLabel="Rechercher un Agent…"
      value=""
      onChange={() => {}}
      onClose={() => {}}
      footer={<p>Aucun Agent trouvé.</p>}
    >
      <button type="button" role="option" aria-selected="false">
        Aïcha HOUNKPATIN
      </button>
      <button type="button" role="option" aria-selected="false">
        Patrick ADJOVI
      </button>
    </AgentSearchPanel>,
  )

  const list = screen.getByRole('listbox')
  const options = within(list).getAllByRole('option')
  options[0].focus()
  await user.keyboard('{ArrowDown}')
  expect(options[1]).toHaveFocus()
  await user.keyboard('{Home}')
  expect(options[0]).toHaveFocus()
  expect(
    within(list).queryByText('Aucun Agent trouvé.'),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Fermer Agent affecté' }),
  ).toBeInTheDocument()
})
