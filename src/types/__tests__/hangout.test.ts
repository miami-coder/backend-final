import { describe, expect, it } from 'vitest'
import { parseHangout, type RawHangout } from '@/types/hangout'

const raw: RawHangout = {
  id: 'h1',
  venueId: 'v1',
  creatorId: 'u1',
  date: '2026-09-10',
  time: '19:30',
  purpose: 'Пошук компанії на дегустацію',
  gender: 'any',
  groupSize: 3,
  payer: 'split',
  desiredBudget: '350',
  status: 'open',
  createdAt: '2026-09-08T10:00:00.000Z',
}

describe('parseHangout', () => {
  it('desiredBudget string → number', () => {
    expect(parseHangout(raw).desiredBudget).toBe(350)
  })
  it('desiredBudget null → null', () => {
    expect(parseHangout({ ...raw, desiredBudget: null }).desiredBudget).toBeNull()
  })
})
