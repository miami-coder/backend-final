import { z } from 'zod'

export const COMPLAINT_REASONS = [
  { value: 'fake_promo', label: 'Фейкова акція' },
  { value: 'fraud', label: 'Шахрайство' },
  { value: 'other', label: 'Інше' },
] as const

export const complaintFormSchema = z
  .object({
    venueId: z.string().uuid().optional(),
    reviewId: z.string().uuid().optional(),
    reason: z.enum(['fake_promo', 'fraud', 'other']),
    text: z.string().trim().min(20, 'Опишіть проблему детальніше (мінімум 20 символів)'),
  })
  .refine((v) => Boolean(v.venueId) !== Boolean(v.reviewId), {
    message: 'Скарга має бути або на заклад, або на відгук',
    path: ['venueId'],
  })

export type ComplaintFormValues = z.infer<typeof complaintFormSchema>
