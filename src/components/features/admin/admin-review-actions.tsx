'use client'

// Дії суперадміна над відгуком (сторінка /admin/reviews): редагування —
// PATCH /reviews/:id (текст + rating; середній рейтинг закладу бекенд
// перераховує сам), видалення — DELETE /reviews/:id.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { deleteReview, updateReview } from '@/services/reviews'
import { ApiError } from '@/lib/api/parse'
import type { AdminReview } from '@/types/review'

export function AdminReviewActions({ item }: { item: AdminReview }) {
  const router = useRouter()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [rating, setRating] = useState(String(item.rating))
  const [text, setText] = useState(item.text)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const ratingNum = Number(rating)
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      setError('Рейтинг — ціле число від 1 до 5')
      return
    }
    if (text.trim().length < 20) {
      setError('Текст — від 20 символів')
      return
    }
    setSaving(true)
    try {
      await updateReview(item.id, { rating: ratingNum, text: text.trim() })
      toast('Відгук оновлено — рейтинг закладу перераховано')
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося оновити відгук')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    try {
      await deleteReview(item.id)
      toast('Відгук видалено')
      setDeleting(false)
      router.refresh()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не вдалося видалити відгук', 'error')
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
        Редагувати
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>
        Видалити
      </Button>

      <Modal open={editing} onClose={() => setEditing(false)} title="Редагувати відгук">
        <form onSubmit={save} className="space-y-2">
          <Select value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Рейтинг відгуку">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Текст відгуку" />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Зберігаємо…' : 'Зберегти'}
          </Button>
        </form>
      </Modal>

      <Modal open={deleting} onClose={() => setDeleting(false)} title="Видалити відгук?">
        <p className="text-muted">Відгук буде видалено безповоротно, рейтинг закладу перерахується.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setDeleting(false)}>Скасувати</Button>
          <Button onClick={remove}>Так, видалити</Button>
        </div>
      </Modal>
    </>
  )
}