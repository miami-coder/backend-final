'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api/parse'
import { createVenueReview, deleteReview, updateReview } from '@/services/reviews'
import { reviewFormSchema } from '@/lib/validation/review'

const MAX_FILE = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

interface MyReview { id: string; rating: number; text: string }

// initialEditing: відкрити редактор одразу (для вбудовування у модалку —
// my-review-item); без нього наявний відгук показується компактною карткою
export function ReviewForm({ venueId, myReview, initialEditing = false }: {
  venueId: string
  myReview: MyReview | null
  initialEditing?: boolean
}) {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const reviewId = myReview?.id ?? null
  const [editing, setEditing] = useState(Boolean(myReview) && initialEditing)
  const [rating, setRating] = useState(myReview?.rating ?? 0)
  const [text, setText] = useState(myReview?.text ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Зміна відгуку зверху (створено/видалено) — поля синхронізуємо, редактор закриваємо.
  // Монтування пропускаємо: initialEditing уже відкрив редактор
  const prevIdRef = useRef<string | null>(reviewId)
  useEffect(() => {
    if (prevIdRef.current === reviewId) return
    prevIdRef.current = reviewId
    setRating(myReview?.rating ?? 0)
    setText(myReview?.text ?? '')
    setEditing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId])

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

  function startEdit() {
    if (!myReview) return
    setRating(myReview.rating)
    setText(myReview.text)
    setError(null)
    setEditing(true)
  }

  // Скасування — правки відкатуються до збереженого відгуку
  function cancelEdit() {
    if (myReview) {
      setRating(myReview.rating)
      setText(myReview.text)
    }
    setError(null)
    setEditing(false)
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
        await createVenueReview(venueId, fd)
        // Після успішного створення форма заново чиста; вкладка «Редагувати»
        // відкриється повністю підставленою зі свіжого myReview
        setRating(0)
        setText('')
        if (fileRef.current) fileRef.current.value = ''
      } else {
        await updateReview(myReview.id, parsed.data)
        setEditing(false)
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
    try {
      // DELETE → 200 з порожнім тілом: парсимо через parseEmpty (apiVoid), не parseData
      await deleteReview(myReview.id)
      setDeleting(false)
      toast('Відгук видалено')
      router.refresh()
    } catch (e) {
      // Модалка лишається відкритою: можна спробувати ще раз або скасувати
      toast(e instanceof ApiError ? e.message : 'Не вдалося видалити відгук', 'error')
      setDeleting(false)
    }
  }

  // Відгук існує й редактор закритий — компактна картка замість постійно
  // відкритої форми: створення й редагування більше не путаються
  if (myReview && !editing) {
    return (
      <>
        <div className="rounded-xl border border-line p-4">
          <p className="text-sm text-muted">Ваш відгук опубліковано — він у списку нижче.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={startEdit}>
              Редагувати
            </Button>
            <Button variant="danger" size="sm" onClick={() => setDeleting(true)}>
              Видалити
            </Button>
          </div>
        </div>
        <Modal open={deleting} onClose={() => setDeleting(false)} title="Видалити відгук?">
          <p className="text-muted">Відгук буде видалено назавжди.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setDeleting(false)}>Скасувати</Button>
            <Button onClick={remove}>Так, видалити</Button>
          </div>
        </Modal>
      </>
    )
  }

  const isEdit = Boolean(myReview)

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
          {isEdit ? 'Зберегти зміни' : 'Надіслати відгук'}
        </Button>
        {isEdit && (
          <Button type="button" variant="secondary" onClick={cancelEdit}>
            Скасувати
          </Button>
        )}
      </div>
    </div>
  )
}