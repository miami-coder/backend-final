'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { api, apiVoid } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { reviewFormSchema } from '@/lib/validation/review'

const MAX_FILE = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

interface MyReview { id: string; rating: number; text: string }

export function ReviewForm({ venueId, myReview }: { venueId: string; myReview: MyReview | null }) {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [rating, setRating] = useState(myReview?.rating ?? 0)
  const [text, setText] = useState(myReview?.text ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user) {
    return (
      <p className="rounded-xl bg-raised p-4 text-sm text-muted">
        Щоб залишити відгук,{' '}
        <Link className="text-amber-500 hover:underline" href={`/auth/login?next=/venues/${venueId}`}>
          Увійдіть
        </Link>{' '}
        або зареєструйтеся.
      </p>
    )
  }

  async function submit() {
    setError(null)
    const parsed = reviewFormSchema.safeParse({ rating, text })
    if (!parsed.success) {
      // помилки полів DTO на поля не маппимо — message першого issue інлайн
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    const file = fileRef.current?.files?.[0]
    if (file) {
      if (!ALLOWED.includes(file.type)) {
        setError('Фото: лише JPEG, PNG або WebP')
        return
      }
      if (file.size > MAX_FILE) {
        setError('Фото не більше 5 МБ')
        return
      }
    }

    setSaving(true)
    try {
      if (!myReview) {
        const fd = new FormData()
        fd.set('rating', String(parsed.data.rating))
        fd.set('text', parsed.data.text)
        if (file) fd.set('checkPhoto', file)
        // multipart БЕЗ content-type (браузер сам ставить boundary) — тому сирий fetch,
        // а не api(): той не ставить заголовків, але тут важливо не зіпсувати multipart;
        // !ok розбираємо вручну в errMessage
        const res = await fetch(`/api/v1/venues/${venueId}/reviews`, { method: 'POST', body: fd })
        if (!res.ok) throw new ApiError(res.status, 'ERROR', await errMessage(res))
      } else {
        await api(`/reviews/${myReview.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed.data),
        })
      }
      toast(myReview ? 'Відгук оновлено' : 'Дякуємо за відгук!')
      router.refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Сервіс тимчасово недоступний')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!myReview) return
    if (!window.confirm('Видалити ваш відгук?')) return
    try {
      // DELETE → 200 з порожнім тілом: парсимо через parseEmpty (apiVoid), не parseData
      await apiVoid(`/reviews/${myReview.id}`, { method: 'DELETE' })
      toast('Відгук видалено')
      router.refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не вдалося видалити відгук', 'error')
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Оцінка</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
              />
              <span className={`text-2xl ${rating >= n ? 'text-amber-400' : 'text-faint'}`} aria-hidden>
                ★
              </span>
              <span className="sr-only">{n}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="review-text" className="block text-sm font-medium">
        Відгук
      </label>
      <Textarea
        id="review-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Розкажіть про враження (мінімум 10 символів)"
      />

      {!myReview && (
        <div className="text-sm">
          <label htmlFor="review-check" className="block">
            Фото чеку (необов&apos;язково, до 5 МБ)
          </label>
          <input
            ref={fileRef}
            id="review-check"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-1"
          />
        </div>
      )}

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="primary" onClick={submit} disabled={saving}>
          {myReview ? 'Зберегти зміни' : 'Надіслати відгук'}
        </Button>
        {myReview && (
          <Button type="button" variant="danger" onClick={remove}>
            Видалити відгук
          </Button>
        )}
      </div>
    </div>
  )
}

// витягнути message з помилкового тіла (може бути не-JSON)
async function errMessage(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as { error?: { message?: string } } | null
    return body?.error?.message ?? 'Сервіс тимчасово недоступний'
  } catch {
    return 'Сервіс тимчасово недоступний'
  }
}
