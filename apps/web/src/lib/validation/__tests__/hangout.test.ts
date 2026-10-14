import { describe, expect, it, vi } from 'vitest'
import { hangoutFormSchema } from '@/lib/validation/hangout'

// локальне «сьогодні» (як у схемі): UTC-варіант би флакав у тестах біля місцевої півночі
const today = () =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const base = { date: today(), time: '19:30', purpose: 'Шукаю компанію на дегустацію', gender: 'any', groupSize: 3, payer: 'me' }

describe('hangoutFormSchema', () => {
  it('валідний пиячок', () => {
    expect(hangoutFormSchema.safeParse(base).success).toBe(true)
  })
  it('бажаний бюджет: рядок коерциться в число, опційний', () => {
    expect(hangoutFormSchema.parse({ ...base, desiredBudget: '350' }).desiredBudget).toBe(350)
    expect(hangoutFormSchema.safeParse({ ...base }).success).toBe(true)
  })
  it('desiredBudget 0..100000, поза — відхилено', () => {
    expect(hangoutFormSchema.safeParse({ ...base, desiredBudget: 100001 }).success).toBe(false)
    expect(hangoutFormSchema.safeParse({ ...base, desiredBudget: -1 }).success).toBe(false)
  })
  it('минула дата — відхилено', () => {
    const past = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    expect(hangoutFormSchema.safeParse({ ...base, date: past }).success).toBe(false)
  })
  it('межа доби: «сьогодні» за ЛОКАЛЬНОю зоною, не UTC (UTC+3, локальне 00:30)', () => {
    const prevTz = process.env.TZ
    process.env.TZ = 'Etc/GMT-3' // POSIX-знак інвертований: Etc/GMT-3 = UTC+3
    vi.useFakeTimers()
    try {
      // 21:30 UTC 09-09 → локально 2026-09-10 00:30; UTC-«сьогодні» — локальне «вчора»
      vi.setSystemTime(new Date('2026-09-09T21:30:00Z'))
      expect(hangoutFormSchema.safeParse({ ...base, date: '2026-09-09' }).success).toBe(false) // вчора за локальним
      expect(hangoutFormSchema.safeParse({ ...base, date: '2026-09-10' }).success).toBe(true) // локальне сьогодні
    } finally {
      vi.useRealTimers()
      if (prevTz === undefined) delete process.env.TZ
      else process.env.TZ = prevTz
    }
  })
  it('дата/час формату: YYYY-MM-DD / HH:mm', () => {
    expect(hangoutFormSchema.safeParse({ ...base, date: '08.09.2026' }).success).toBe(false)
    expect(hangoutFormSchema.safeParse({ ...base, time: '25:00' }).success).toBe(false)
  })
  it('purpose 10..500, groupSize int 1..20', () => {
    expect(hangoutFormSchema.safeParse({ ...base, purpose: 'коротко' }).success).toBe(false)
    expect(hangoutFormSchema.safeParse({ ...base, groupSize: 21 }).success).toBe(false)
    expect(hangoutFormSchema.safeParse({ ...base, groupSize: 2.5 }).success).toBe(false)
  })
})
