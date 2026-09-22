'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { RatingStars } from '@/components/ui/rating-stars'
import { ReviewForm } from '@/components/features/venues/review-form'
import { apiVoid } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { formatDate } from '@/lib/utils/format'
import { useToast } from '@/components/ui/toast'
import type { Review } from '@/types/review'

export function MyReviewItem({ review, venueName }: { review: Review; venueName: string | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function remove() {
    try {
      // DELETE → 200 з порожнім тілом (apiVoid), далі оновлюємо серверні дані
      await apiVoid(`/reviews/${review.id}`, { method: 'DELETE' })
      // закриваємо лише за успіху: при помилці модалка лишається — можна повторити/скасувати
      setDeleting(false)
      router.refresh()
    } catch (e) {
      // як у ReviewForm: ApiError → message з бекенда, інакше — загальний текст
      toast(e instanceof ApiError ? e.message : 'Не вдалося видалити відгук', 'error')
    }
  }

  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex items-center gap-3">
        <RatingStars value={review.rating} />
        <span className="text-sm text-muted">{formatDate(review.createdAt)}</span>
        <Link className="ml-auto text-sm text-amber-500 hover:underline" href={`/venues/${review.venueId}`}>
          {venueName ?? 'Переглянути заклад'}
        </Link>
      </div>
      <p className="mt-2 whitespace-pre-line text-muted">{review.text}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Редагувати</Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>Видалити</Button>
      </div>

      {/* ReviewForm не приймає onDone: після PATCH він сам робить toast + router.refresh(),
          але модалку не закриває — користувач закриває її сам (Esc / «×» / клік поза модалкою). */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Редагувати відгук">
        <ReviewForm venueId={review.venueId} myReview={{ id: review.id, rating: review.rating, text: review.text }} />
      </Modal>

      <Modal open={deleting} onClose={() => setDeleting(false)} title="Видалити відгук?">
        <p className="text-muted">Відгук буде видалено назавжди.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setDeleting(false)}>Скасувати</Button>
          <Button onClick={remove}>Так, видалити</Button>
        </div>
      </Modal>
    </li>
  )
}
