import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMyRecommendations } from '@/services/venues.server'
import { getSessionTokens } from '@/lib/auth/session'
import { parseVenue, type Venue } from '@/types/venue'
import { RecommendButton } from '@/components/features/venues/recommend-button'
import { RatingStars } from '@/components/ui/rating-stars'
import { formatMoney } from '@/lib/utils/format'
import { placeholderFor } from '@/lib/utils/placeholder'

// Рядок рекомендованого закладу: мініатюра + назва/адреса, рейтинг,
// середній чек — і кнопка «Зняти рекомендацію» (кнопка сама показується
// лише критику/супер-адміну, у списку свої рекомендації, тому `mine` завжди)
function RecommendedRow({ v }: { v: Venue }) {
  const thumb = v.mainPhotoUrl ?? v.photos[0]?.url ?? null
  return (
    <tr className="border-t border-line align-middle">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-raised">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div style={{ background: placeholderFor(v.id) }} className="h-full w-full" />
            )}
          </div>
          <div className="min-w-0">
            <Link className="font-medium text-ink hover:underline" href={`/venues/${v.id}`}>{v.name}</Link>
            <p className="truncate text-sm text-muted">{v.address}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RatingStars value={v.ratingAvg} />
      </td>
      <td className="px-4 py-3 text-muted">{formatMoney(v.averageCheck)}</td>
      <td className="px-4 py-3 text-right">
        {/* /me/recommendations віддає лише свою рекомендацію → кнопка «Зняти» */}
        <RecommendButton venueId={v.id} recommendedBy={v.recommendedBy} />
      </td>
    </tr>
  )
}

export default async function MyRecommendationsPage() {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/recommendations')
  const raw = await getMyRecommendations(tokens)
  const venues = raw.map(parseVenue)

  return (
    <section>
      <h2 className="font-display text-lg font-semibold">Рекомендовані мною</h2>
      <p className="mt-1 text-sm text-muted">
        Заклади, які ви рекомендували як критик. Зняти рекомендацію можна тут або
        на сторінці закладу.
      </p>
      {venues.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-muted">Рекомендованих закладів поки немає.</p>
          <Link className="mt-4 inline-block text-amber-500 hover:underline" href="/venues">
            Переглянути каталог
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-medium text-faint">
                <th scope="col" className="px-4 py-2">Заклад</th>
                <th scope="col" className="px-4 py-2">Рейтинг</th>
                <th scope="col" className="px-4 py-2">Середній чек</th>
                <th scope="col" className="px-4 py-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <RecommendedRow key={v.id} v={v} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}