import { z } from 'zod'

// Тіло повідомлення: бекенд DTO — IsString, IsNotEmpty, MaxLength(2000)
export const messageFormSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Введіть текст повідомлення')
    .max(2000, 'Максимум 2000 символів'),
})

export type MessageForm = z.infer<typeof messageFormSchema>