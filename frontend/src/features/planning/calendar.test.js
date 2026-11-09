import { expect, test, vi } from 'vitest'
import { readCalendar } from './calendar'

test('calendar loads every page with the same filters, independent of table cursor', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({
      count: 2,
      data: [{ id: 'a' }],
      next: `${window.location.origin}/api/v1/ptas/plan/activities?limit=100&q=test&state=returned&agent=agent-1&from=2028-02-01&to=2028-02-29&cursor=second`,
    })
    .mockResolvedValueOnce({ count: 2, data: [{ id: 'b' }], next: null })
  const signal = new AbortController().signal
  const result = await readCalendar(
    { request },
    'plan',
    {
      q: 'test',
      state: 'returned',
      agent: 'agent-1',
      from: '2028-02-01',
      to: '2028-02-29',
    },
    signal,
  )
  expect(result.data.map((row) => row.id)).toEqual(['a', 'b'])
  expect(result.next).toBeNull()
  expect(request).toHaveBeenNthCalledWith(
    1,
    '/api/v1/ptas/plan/activities?limit=100&q=test&state=returned&agent=agent-1&from=2028-02-01&to=2028-02-29',
    { signal },
  )
  expect(request).toHaveBeenNthCalledWith(
    2,
    '/api/v1/ptas/plan/activities?limit=100&q=test&state=returned&agent=agent-1&from=2028-02-01&to=2028-02-29&cursor=second',
    { signal },
  )
})

test('calendar refuses partial results and untrusted pagination links', async () => {
  const request = vi.fn().mockResolvedValue({
    count: 2,
    data: [{ id: 'a' }],
    next: 'https://elsewhere.test/api/v1/ptas/plan/activities?cursor=x',
  })
  await expect(
    readCalendar({ request }, 'plan', {}, new AbortController().signal),
  ).rejects.toThrow()
  expect(request).toHaveBeenCalledTimes(1)
  request.mockResolvedValue({ count: 2, data: [{ id: 'a' }], next: null })
  await expect(
    readCalendar({ request }, 'plan', {}, new AbortController().signal),
  ).rejects.toThrow()
})
