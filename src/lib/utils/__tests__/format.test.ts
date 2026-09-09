import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils/format'

describe('formatMoney', () => {
  it('округлює до цілих ₴', () => {
    expect(formatMoney(450)).toBe('450 ₴')
    expect(formatMoney(450.9)).toBe('451 ₴')
  })
  it('null → —', () => {
    expect(formatMoney(null)).toBe('—')
  })
})

describe('formatDate', () => {
  it('uk-формат', () => {
    expect(formatDate('2026-09-08T10:00:00.000Z')).toMatch(/^8 вересня 2026/)
  })
})

describe('formatDateTime', () => {
  it('uk-формат з часом', () => {
    expect(formatDateTime('2026-09-08T10:00:00.000Z')).toMatch(/2026/)
    expect(formatDateTime('2026-09-08T10:00:00.000Z')).toMatch(/\d{2}:\d{2}/)
  })
})
