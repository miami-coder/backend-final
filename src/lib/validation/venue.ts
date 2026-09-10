import { z } from 'zod'

export const WH_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const timeRangeRe = /^\d{2}:\d{2}-\d{2}:\d{2}$/

export function csvToArray(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

const contactsSchema = z
  .object({
    phone: z.string().trim().optional(),
    instagram: z.string().trim().optional(),
    facebook: z.string().trim().optional(),
    website: z.string().trim().optional(),
  })
  .optional()

export const venueCreateSchema = z.object({
  name: z.string().trim().min(3, 'Мінімум 3 символи'),
  address: z.string().trim().min(5, 'Мінімум 5 символів'),
  description: z.string().trim().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  contacts: contactsSchema,
  workingHours: z
    .record(z.string(), z.string().regex(timeRangeRe, 'Формат: HH:MM-HH:MM'))
    .optional(),
  averageCheck: z.coerce.number().min(0, 'Не менше 0').optional(),
  featureCodes: z.array(z.string()).max(20, 'Максимум 20').optional(),
  tagSlugs: z.array(z.string()).max(20, 'Максимум 20').optional(),
  typeSlug: z.string().trim().optional(),
})

export const venueUpdateSchema = venueCreateSchema.partial()

export type VenueCreateValues = z.infer<typeof venueCreateSchema>
export type VenueUpdateValues = z.infer<typeof venueUpdateSchema>
