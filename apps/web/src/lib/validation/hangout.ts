import { z } from 'zod'

const dateRe = /^\d{4}-\d{2}-\d{2}$/
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

// «Сьогодні» в ЛОКАЛЬНІЙ зоні користувача (en-CA дає YYYY-MM-DD).
// toISOString() дав би UTC: у UTC+2/+3 між 00:00 і 02:59 за місцевим часом
// UTC-«сьогодні» ще «вчора», і учорашня дата проходила б валідацію.
// Бекенд — авторитетний re-validator: при негативних офсетах на межі доби
// користувач міг би отримати 400 — тому клієнтська межа теж за локальною зоною.
const localToday = () =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

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
      (d) => d >= localToday(),
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
