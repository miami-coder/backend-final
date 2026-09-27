import { redirect } from 'next/navigation'
import { ProfileForm, type ProfileFields } from '@/components/features/account/profile-form'
import { getMyProfile } from '@/services/users.server'
import { getSessionTokens } from '@/lib/auth/session'

export default async function AccountProfilePage() {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account')
  const me = await getMyProfile<ProfileFields>(tokens)
  return (
    <section>
      <h2 className="mb-4 font-display text-lg font-semibold">Профіль</h2>
      <ProfileForm profile={me.profile} />
    </section>
  )
}
