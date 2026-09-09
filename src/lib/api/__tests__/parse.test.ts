import { describe, expect, it } from 'vitest'
import { parseData, parseEmpty, parseList, parseRaw } from '@/lib/api/parse'

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('parseData', () => {
  it('розгортає {data: T}', async () => {
    const res = jsonRes({ data: { id: '1' } })
    expect(await parseData<{ id: string }>(res)).toEqual({ id: '1' })
  })
  it('кидає ApiError з полів error бекенда', async () => {
    const res = jsonRes({ error: { code: 'NOT_FOUND', message: 'Заклад не знайдено', details: null } }, 404)
    await expect(parseData(res)).rejects.toMatchObject({
      status: 404, code: 'NOT_FOUND', message: 'Заклад не знайдено',
    })
  })
  it('кидає ApiError INTERNAL_ERROR при несподіваному тілі', async () => {
    const res = jsonRes({ smth: 'wrong' })
    // тіло 2xx-відповіді вже прочитане — помилка конструюється без повторного res.json()
    await expect(parseData(res)).rejects.toMatchObject({
      status: 200, code: 'INTERNAL_ERROR', message: 'Сервіс тимчасово недоступний', details: null,
    })
  })
  it('не-JSON error-тіло (HTML 502) → ApiError INTERNAL_ERROR', async () => {
    const res = new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } })
    await expect(parseData(res)).rejects.toMatchObject({
      status: 502, code: 'INTERNAL_ERROR', message: 'Сервіс тимчасово недоступний',
    })
  })
})

describe('parseList', () => {
  it('повертає data + meta', async () => {
    const res = jsonRes({ data: [{ a: 1 }], meta: { page: 1, limit: 20, total: 1, hasMore: false } })
    expect(await parseList<{ a: number }>(res)).toEqual({
      data: [{ a: 1 }],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
  })
  it('meta з рядкових значень коерціюється в числа', async () => {
    const res = jsonRes({ data: [1], meta: { page: '2', limit: '20', total: '40', hasMore: 1 } })
    expect(await parseList<number>(res)).toEqual({
      data: [1],
      meta: { page: 2, limit: 20, total: 40, hasMore: true },
    })
  })
})

describe('parseEmpty', () => {
  it('порожнє тіло (DELETE → 200) → undefined, без кидка', async () => {
    const res = new Response('', { status: 200 })
    expect(await parseEmpty(res)).toBeUndefined()
  })
  it('JSON-конверт з data — розгортає, як parseData', async () => {
    const res = jsonRes({ data: { venueId: 'v1' } }, 201)
    expect(await parseEmpty<{ venueId: string }>(res)).toEqual({ venueId: 'v1' })
  })
  it('ok → void, !ok → ApiError', async () => {
    await expect(parseEmpty(new Response(null, { status: 200 }))).resolves.toBeUndefined()
    const res403 = new Response(
      JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Не ваш відгук', details: null } }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    )
    await expect(parseEmpty(res403)).rejects.toMatchObject({ status: 403, message: 'Не ваш відгук' })
  })
})

describe('parseRaw', () => {
  it('не розгортає обгортку (формат /auth/login)', async () => {
    const res = jsonRes({ accessToken: 'a', refreshToken: 'r', user: { id: 'u' } }, 201)
    expect(await parseRaw<{ accessToken: string }>(res)).toEqual({
      accessToken: 'a', refreshToken: 'r', user: { id: 'u' },
    })
  })
})
