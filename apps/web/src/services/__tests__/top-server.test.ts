import { describe, expect, it, vi, beforeEach } from 'vitest'

const serverFetch = vi.fn()
const serverFetchList = vi.fn()
vi.mock('@/lib/api/server-client', () => ({
  serverFetch: (...a: unknown[]) => serverFetch(...a),
  serverFetchList: (...a: unknown[]) => serverFetchList(...a),
}))

import { getTop, getRecommendedVenues } from '../top.server'

describe('top.server — кешування (стрілки в адмінці мають бути видно одразу)', () => {
  beforeEach(() => {
    serverFetch.mockResolvedValue([])
    serverFetchList.mockResolvedValue({ data: [] })
  })

  it('getTop → revalidate: 0 (нічого не кешуємо, reorder адмінки видно одразу)', async () => {
    await getTop()
    expect(serverFetch).toHaveBeenCalledWith('/top', expect.objectContaining({ revalidate: 0 }))
  })

  it('getRecommendedVenues → revalidate: 0', async () => {
    await getRecommendedVenues()
    // serverFetchList(path, opts) — opts.revalidate 0
    expect(serverFetchList).toHaveBeenCalledWith('/venues?recommended=1&limit=12&page=1', expect.objectContaining({ revalidate: 0 }))
  })
})