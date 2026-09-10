import { redirect } from 'next/navigation'
import { VenueCreateForm } from '@/components/features/venues/venue-create-form'
import { getSessionTokens } from '@/lib/auth/session'

export const metadata = { title: 'Новий заклад — Пиячок' }

export default async function NewVenuePage() {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/venues/new')
  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="mb-4 text-2xl font-bold">Подати заклад</h1>
      <VenueCreateForm />
    </div>
  )
}
