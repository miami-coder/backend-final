import { z } from 'zod'

export const NEWS_CATEGORIES = [
  { value: 'general', label: 'Загальне' },
  { value: 'promo', label: 'Акції' },
  { value: 'event', label: 'Події' },
] as const

export const newsFormSchema = z.object({
  category: z.enum(['general', 'promo', 'event']),
  title: z.string().trim().min(5, 'Мінімум 5 символів').max(200, 'Максимум 200 символів'),
  content: z.string().trim().min(20, 'Мінімум 20 символів'),
  imageUrl: z.string().trim().optional(),
})

export type NewsFormValues = z.infer<typeof newsFormSchema>
