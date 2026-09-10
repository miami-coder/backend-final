import { z } from 'zod'

export const profileUpdateSchema = z.object({
  firstname: z.string().trim().min(2, 'Мінімум 2 символи').optional(),
  lastname: z.string().trim().min(2, 'Мінімум 2 символи').optional(),
  phone: z.string().trim().optional(),
  age: z.coerce.number().int('Ціле число').optional(),
  avatarUrl: z.string().trim().optional(),
})

export type ProfileUpdateValues = z.infer<typeof profileUpdateSchema>
