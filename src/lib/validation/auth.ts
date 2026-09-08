import { z } from 'zod'

// zod v4 дефолтний email-патерн вимагає TLD ≥2 символів, але @IsEmail() на бекенді
// (validator.js) приймає однолітерні TLD — тому мінімально перевизначаємо патерн.
const emailPattern = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{1,}$/

export const loginSchema = z.object({
  email: z.string().email({ message: 'Некоректний email', pattern: emailPattern }),
  password: z.string().min(1, 'Вкажіть пароль'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  firstname: z.string().min(2, 'Мінімум 2 символи'),
  lastname: z.string().min(2, 'Мінімум 2 символи'),
  email: z.string().email({ message: 'Некоректний email', pattern: emailPattern }),
  password: z
    .string()
    .min(8, 'Мінімум 8 символів')
    // Бекенд (password.validator.ts) вимагає саме ЛАТИНСЬКУ велику літеру — кирилицю не приймає
    .regex(/[A-Z]/, 'Потрібна хоча б одна велика латинська літера')
    .regex(/\d/, 'Потрібна хоча б одна цифра'),
  age: z.coerce.number().int().min(18, 'Мінімум 18 років').optional(),
  phone: z.string().optional(),
  acceptEula: z.literal(true, { message: 'Потрібно прийняти угоду користувача' }),
})
export type RegisterValues = z.infer<typeof registerSchema>
