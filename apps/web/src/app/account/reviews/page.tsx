import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MyReviewItem } from '@/components/features/account/my-review-item'
import { getMyReviews } from '@/services/reviews.server'
import { getSessionTokens } from '@/lib/auth/session'
import { parseReview, type RawReview } from '@/types/review'

export default async function MyReviewsPage() {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/reviews')
  // бекенд віддає {data: RawReview[]} без meta — serverFetch (parseData), не serverFetchList
  const raw = await getMyReviews(tokens)
  const reviews = raw.map(parseReview)

  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-muted">Ви ще не залишали відгуки.</p>
        <Link className="mt-4 inline-block text-amber-500 hover:underline" href="/">Перейти до каталогу</Link>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {/* Бекенд не віддає назву закладу в /me/reviews — без N+1-збагачення,
          рядок-посилання «Переглянути заклад» */}
      {reviews.map((r) => <MyReviewItem key={r.id} review={r} venueName={null} />)}
    </ul>
  )
}
