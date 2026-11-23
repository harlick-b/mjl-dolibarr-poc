import { expect, test, vi } from 'vitest'
import { findPaginatedItem } from './pagination'

test('resolves a shared selection beyond the first local page', async () => {
  const api = {
    request: vi.fn(async (path) => ({
      data: [{ id: 'selected', name: 'Selected row' }],
      next: null,
      previous: '/api/v1/projects?limit=60',
      requestedPath: path,
    })),
  }

  const result = await findPaginatedItem({
    api,
    path: '/projects',
    id: 'selected',
    firstPage: {
      data: [{ id: 'first', name: 'First row' }],
      next: '/api/v1/projects?limit=60&cursor=second',
      previous: null,
    },
  })

  expect(result).toMatchObject({ id: 'selected' })
  expect(api.request).toHaveBeenCalledWith(
    '/api/v1/projects?limit=60&cursor=second',
    { signal: undefined },
  )
})
