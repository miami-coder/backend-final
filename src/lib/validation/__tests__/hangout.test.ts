import { describe, expect, it } from 'vitest'
import { hangoutFormSchema } from '@/lib/validation/hangout'

const today = () => new Date().toISOString().slice(0, 10)
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
