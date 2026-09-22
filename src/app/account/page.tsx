import { redirect } from 'next/navigation'
import { ProfileForm, type ProfileFields } from '@/components/features/account/profile-form'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'

export default async function AccountProfilePage() {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account')
  const me = await serverFetch<{ profile: ProfileFields }>('/me', { tokens, revalidate: 0 })
  return (
    <section>
      <h2 className="mb-4 font-display text-lg font-semibold">Профіль</h2>
      <ProfileForm profile={me.profile} />
    </section>
  )
}
