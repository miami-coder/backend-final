import { describe, expect, it } from 'vitest'
import { complaintFormSchema } from '@/lib/validation/complaint'

const text = 'c'.repeat(20)
// бріф мав фіксчури «uuid-1»/«a», але схема вимагає .uuid() — беремо валідні UUID,
// щоб тест ізолював саме XOR-правило/enum, а не формат ідентифікатора
const venueId = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const reviewId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'

describe('complaintFormSchema', () => {
  it('venueId-варіант валідний', () => {
    expect(complaintFormSchema.safeParse({ venueId, reason: 'fraud', text }).success).toBe(true)
  })
  it('reviewId-варіант валідний', () => {
    expect(complaintFormSchema.safeParse({ reviewId, reason: 'other', text }).success).toBe(true)
  })
  it('без venueId і reviewId — відхилено', () => {
    expect(complaintFormSchema.safeParse({ reason: 'other', text }).success).toBe(false)
  })
  it('ОДНОЧАСНО venueId і reviewId — відхилено (бекенд вимагає XOR)', () => {
    expect(complaintFormSchema.safeParse({ venueId, reviewId, reason: 'other', text }).success).toBe(false)
  })
  it('reason поза enum / text < 20 — відхилено', () => {
    expect(complaintFormSchema.safeParse({ venueId, reason: 'spam', text }).success).toBe(false)
    expect(complaintFormSchema.safeParse({ venueId, reason: 'other', text: 'мало символів' }).success).toBe(false)
  })
})
