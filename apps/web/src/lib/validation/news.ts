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

// Адмінська версія публічної newsFormSchema: додано статус публікації
// (draft|published, за замовчуванням published) та промо-прапорець.
// Публічна схема лишається недоторканою — нею користуються форми Плану 3
// (захисний тест у src/lib/validation/__tests__/news.test.ts).
export const adminNewsFormSchema = newsFormSchema.extend({
  status: z.enum(['draft', 'published']).default('published'),
  isPromoted: z.boolean().default(false),
})

export type AdminNewsFormValues = z.infer<typeof adminNewsFormSchema>
