import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const getHangouts = vi.fn()
const getMyHangoutIds = vi.fn()
vi.mock('@/services/hangouts.server', () => ({
  getHangouts: (...args: unknown[]) => getHangouts(...args),
  getMyHangoutIds: (...args: unknown[]) => getMyHangoutIds(...args),
}))
// клієнтський острів (useUser кидає поза UserProvider у renderToStaticMarkup):
// серверний тест фокусується на серверних турботах, поведінку кнопки вкрито
// hangout-join-button.test.tsx — тут ловимо проп initialJoined (стан «В тусовці!»)
vi.mock('@/components/features/hangouts/hangout-join-button', () => ({
  HangoutJoinButton: (props: { hangoutId: string; initialJoined?: boolean }) =>
    createElement('span', null, `JOIN:${props.hangoutId}:${props.initialJoined ? 'joined' : 'open'}`),
}))

vi.mock('@/lib/auth/session', () => ({ getSessionTokens: async () => ({ accessToken: 'a', refreshToken: 'r' }) }))

import HangoutsPage from '@/app/hangouts/page'

const rawHangout = {
  id: 'h1', venueId: 'v1', creatorId: 'u1',
  date: '2026-09-20', time: '19:00',
  purpose: 'Дегустація крафтового пива', gender: 'any',
  groupSize: 4, payer: 'split', desiredBudget: '500',
  status: 'open',
  venue: { id: 'v1', name: 'Кварцяна Лузга', address: 'вул. Тестова, 1', mainPhotoUrl: null },
  createdAt: '2026-09-10T10:00:00Z',
}

describe('/hangouts', () => {
  beforeEach(() => {
    getHangouts.mockReset().mockResolvedValue({
      data: [rawHangout],
      meta: { page: 1, limit: 12, total: 13, hasMore: true },
    })
    getMyHangoutIds.mockReset().mockResolvedValue(new Set<string>(['h1']))
  })

  // ⚠️ бриф: твердження звірено з фактичним форматом шляху — конкатенація
  // `?page=&limit=&status=` (дефолт status=open), далі venueId/date
  it('дефолтний фільтр status=open, картка з purpose/датою/закладом і лінком', async () => {
    const html = renderToStaticMarkup(await HangoutsPage({ searchParams: Promise.resolve({}) }))
    expect(getHangouts).toHaveBeenCalledWith('page=1&limit=12&status=open')
    // стан «В тусовці!» — id з моїх зустрічей долетіли до кнопки
    expect(getMyHangoutIds).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' })
    expect(html).toContain('JOIN:h1:joined')
    expect(html).toContain('Дегустація крафтового пива')
    expect(html).toContain('2026-09-20')
    expect(html).toContain('Кварцяна Лузга')
    // лейбл payer — канонічна константа HANGOUT_PAYERS (пріоритет «Ділити порівну»)
    expect(html).toContain('Ділити порівну')
    expect(html).toContain('/hangouts/h1')
    // Produces-контракт брифа: картка кліком веде на /hangouts/[id] —
    // рядок дата/час обгорнуто лінком на деталі зустрічі
    expect(html).toContain('<a class="font-medium hover:underline" href="/hangouts/h1">2026-09-20 · 19:00</a>')
    // meta total 13 / limit 12 → пагінація зі збереженим фільтром статусу
    // (& екранується renderToStaticMarkup у href)
    expect(html).toContain('/hangouts?page=2&amp;status=open')
  })

  it('?status=filled, ?date та ?venueId передаються у запит', async () => {
    renderToStaticMarkup(await HangoutsPage({ searchParams: Promise.resolve({ status: 'filled' }) }))
    expect(getHangouts).toHaveBeenCalledWith('page=1&limit=12&status=filled')
    renderToStaticMarkup(await HangoutsPage({ searchParams: Promise.resolve({ date: '2026-09-10', venueId: 'v1' }) }))
    expect(getHangouts).toHaveBeenCalledWith('page=1&limit=12&status=open&venueId=v1&date=2026-09-10')
  })

  it('невідомий status відкидається на дефолт open', async () => {
    renderToStaticMarkup(await HangoutsPage({ searchParams: Promise.resolve({ status: 'hacked' }) }))
    expect(getHangouts).toHaveBeenCalledWith('page=1&limit=12&status=open')
  })

  it('не в моїх зустрічах → кнопка «Приєднатися» (open)', async () => {
    getMyHangoutIds.mockResolvedValueOnce(new Set<string>())
    const html = renderToStaticMarkup(await HangoutsPage({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('JOIN:h1:open')
  })

  it('порожньо → «Немає відкритих зустрічей»', async () => {
    getHangouts.mockResolvedValue({ data: [] })
    const html = renderToStaticMarkup(await HangoutsPage({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('Немає відкритих зустрічей')
  })
})
