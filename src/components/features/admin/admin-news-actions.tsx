'use client'

// Дії суперадміна над новиною в списку /admin/news: редагування (модалка —
// PATCH /news/:id, дозвіл news:manage:any) і видалення (DELETE /news/:id,
// м'яке — archived). Успіх → toast + router.refresh().

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { deleteNews, updateNews } from '@/services/news'
import { ApiError } from '@/lib/api/parse'
import { NEWS_CATEGORIES } from '@/lib/validation/news'
import { NEWS_STATUS_LABELS, type News, type NewsStatus } from '@/types/news'

export function AdminNewsActions({ item }: { item: News }) {
  const router = useRouter()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [content, setContent] = useState(item.content)
  const [category, setCategory] = useState(item.category)
  const [status, setStatus] = useState<NewsStatus>(item.status)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (title.trim().length < 5) {
      setError('Заголовок — від 5 символів')
      return
    }
    if (content.trim().length < 20) {
      setError('Текст — від 20 символів')
      return
    }
    setSaving(true)
    try {
      await updateNews(item.id, { title: title.trim(), content: content.trim(), category, status })
      toast('Новину оновлено')
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося оновити новину')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    try {
      await deleteNews(item.id)
      toast('Новину заархівовано')
      setDeleting(false)
      router.refresh()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не вдалося видалити новину', 'error')
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
        Редагувати
      </Button>
      {item.status !== 'archived' && (
        <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>
          Видалити
        </Button>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Редагувати новину">
        <form onSubmit={save} className="space-y-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Категорія">
            {NEWS_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as NewsStatus)} aria-label="Статус">
            {(Object.keys(NEWS_STATUS_LABELS) as NewsStatus[]).map((s) => (
              <option key={s} value={s}>{NEWS_STATUS_LABELS[s]}</option>
            ))}
          </Select>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Заголовок новини" />
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} aria-label="Текст новини" />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Зберігаємо…' : 'Зберегти'}
          </Button>
        </form>
      </Modal>

      <Modal open={deleting} onClose={() => setDeleting(false)} title="Видалити новину?">
        <p className="text-muted">
          «{item.title}» буде заархівована і зникне з публічного списку.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setDeleting(false)}>Скасувати</Button>
          <Button onClick={remove}>Так, видалити</Button>
        </div>
      </Modal>
    </>
  )
}