import { describe, expect, it } from 'vitest'
import { parseData, parseList, parseRaw } from '@/lib/api/parse'

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
})

describe('parseList', () => {
  it('повертає data + meta', async () => {
    const res = jsonRes({ data: [{ a: 1 }], meta: { page: 1, limit: 20, total: 1, hasMore: false } })
    expect(await parseList<{ a: number }>(res)).toEqual({
      data: [{ a: 1 }],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
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
