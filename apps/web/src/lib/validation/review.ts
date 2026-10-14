import { z } from 'zod'

export const reviewFormSchema = z.object({
  // min(1) з меседжем «Оцініть заклад»: rating=0 (не вибрано) показує саме його,
  // бо 0 — валідний тип, провалюється лише межа
  rating: z.number({ message: 'Оцініть заклад' }).int().min(1, 'Оцініть заклад').max(5, 'Максимум 5'),
  text: z.string().trim().min(10, 'Мінімум 10 символів').max(2000, 'Максимум 2000 символів'),
})

export type ReviewFormValues = z.infer<typeof reviewFormSchema>
