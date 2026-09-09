import { z } from 'zod'

const dateRe = /^\d{4}-\d{2}-\d{2}$/
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

export const HANGOUT_GENDERS = [
  { value: 'any', label: 'Будь-хто' },
  { value: 'male', label: 'Чоловіки' },
  { value: 'female', label: 'Жінки' },
] as const

export const HANGOUT_PAYERS = [
  { value: 'me', label: 'Я плачу' },
  { value: 'split', label: 'Ділити порівну' },
  { value: 'them', label: 'Платить компанія' },
] as const

export const hangoutFormSchema = z
  .object({
    date: z.string().regex(dateRe, 'Формат дати: YYYY-MM-DD').refine(
      (d) => d >= new Date().toISOString().slice(0, 10),
      'Дата не може бути в минулому',
    ),
    time: z.string().regex(timeRe, 'Формат часу: HH:mm'),
    purpose: z.string().trim().min(10, 'Мінімум 10 символів').max(500, 'Максимум 500 символів'),
    gender: z.enum(['any', 'male', 'female']),
    groupSize: z.coerce.number().int('Ціле число').min(1, 'Мінімум 1').max(20, 'Максимум 20'),
    payer: z.enum(['me', 'split', 'them']),
    desiredBudget: z.coerce.number().min(0).max(100000, 'Максимум 100000').optional(),
  })

export type HangoutFormValues = z.infer<typeof hangoutFormSchema>
