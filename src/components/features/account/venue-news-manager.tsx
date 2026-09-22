'use client'

// Управління новинами закладу (вкладка «Новини»): створення через
// POST /me/venues/:venueId/news (venueId іде в URL, НЕ у body), редагування
// PATCH /news/:id, видалення DELETE /news/:id (apiVoid — тіло {data} або
// порожнє tolerated). Усі успіхи → toast + router.refresh() (список фетчить
// серверна вкладка page.tsx через serverFetchList і приходить пропом).
//
// Публічний список /news?venueId= повертає лише published: видалення з
// UI = архів на бекенді, тому новина зникає зі списку — задокументовано
// в hint під формою і в тексті підтвердження видалення.
//
// Відхилення від референс-імплементації брифа: saveEdit ресендить наявний
// imageUrl (модалка його не редагує) — без цього PATCH без поля міг би
// витерти зображення, залежно від семантики бекенда.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api, apiVoid } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { NEWS_CATEGORIES, newsFormSchema } from '@/lib/validation/news'
import { formatDate } from '@/lib/utils/format'
import type { News, NewsCategory } from '@/types/news'

export function VenueNewsManager({ venueId, news }: { venueId: string; news: News[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [category, setCategory] = useState<NewsCategory>('general')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [editing, setEditing] = useState<News | null>(null)
  const [deleting, setDeleting] = useState<News | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = newsFormSchema.safeParse({
      category,
      title,
      content,
      ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSending(true)
    try {
      // venueId лише в URL — у body його бекенд не очікує
      await api(`/me/venues/${venueId}/news`, { method: 'POST', body: JSON.stringify(parsed.data) })
      toast('Новину додано')
      setTitle('')
      setContent('')
      setImageUrl('')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося додати новину')
    } finally {
      setSending(false)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    const parsed = newsFormSchema.safeParse({
      category: editing.category,
      title: editing.title,
      content: editing.content,
      ...(editing.imageUrl ? { imageUrl: editing.imageUrl } : {}),
    })
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? 'Перевірте поля', 'error')
      return
    }
    try {
      await api(`/news/${editing.id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) })
      toast('Новину оновлено')
      setEditing(null)
      router.refresh()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не вдалося оновити новину', 'error')
    }
  }

  async function remove() {
    if (!deleting) return
    try {
      // DELETE → 200 з {data} або порожнім тілом — apiVoid tolerate обидва
      await apiVoid(`/news/${deleting.id}`, { method: 'DELETE' })
      setDeleting(null)
      router.refresh()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не вдалося видалити новину', 'error')
    }
  }

  return (
    <section aria-label="Новини закладу">
      <form onSubmit={submit} className="space-y-2 rounded-xl border border-line p-4" aria-label="Нова новина">
        <Select value={category} onChange={(e) => setCategory(e.target.value as NewsCategory)} aria-label="Категорія">
          {NEWS_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок (від 5 символів)" aria-label="Заголовок новини" />
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Текст (від 20 символів)" aria-label="Текст новини" />
        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL зображення (опційно)" aria-label="URL зображення" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={sending}>{sending ? 'Додаємо…' : 'Додати новину'}</Button>
      </form>
      <p className="mt-2 text-sm text-muted">
        Публічний список показує лише опубліковані новини: заархівовані зникають із публічної сторінки закладу.
      </p>

      {news.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Новин у закладу ще немає.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {news.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
              <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
                {NEWS_CATEGORIES.find((c) => c.value === n.category)?.label}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{n.title}</span>
              {n.publishedAt && <span className="text-sm text-muted">{formatDate(n.publishedAt)}</span>}
              <Button variant="secondary" size="sm" onClick={() => setEditing(n)}>Редагувати</Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(n)}>Видалити</Button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Редагувати новину">
        {editing && (
          <form onSubmit={saveEdit} className="space-y-2">
            <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} aria-label="Заголовок новини" />
            <Textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} aria-label="Текст новини" />
            <Button type="submit">Зберегти</Button>
          </form>
        )}
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Видалити новину?">
        <p className="text-muted">Новина буде видалена (заархівована) і зникне з публічного списку.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Скасувати</Button>
          <Button onClick={remove}>Так, видалити</Button>
        </div>
      </Modal>
    </section>
  )
}
