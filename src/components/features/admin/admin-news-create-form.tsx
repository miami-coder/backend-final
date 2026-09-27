'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { createAdminNews } from '@/services/news'
import { ApiError } from '@/lib/api/parse'
import { NEWS_CATEGORIES, adminNewsFormSchema } from '@/lib/validation/news'
import { NEWS_STATUS_LABELS } from '@/types/news'

// Глобальне створення новини в адмінці: POST /admin/news з DTO
// { category, title, content, imageUrl?, status, isPromoted }.
// Статус лише draft|published (архів — окрема дія на бекенді), за
// замовчуванням published. Помилки (валідація схеми та ApiError) — inline,
// щоб можна було повторити спробу; успіх → toast + reset + refresh.
export function AdminNewsCreateForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [category, setCategory] = useState('general')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('published')
  const [isPromoted, setIsPromoted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setCategory('general')
    setTitle('')
    setContent('')
    setImageUrl('')
    setStatus('published')
    setIsPromoted(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return // in-flight гард: подвійний клік не шле другий запит
    setError(null)
    const parsed = adminNewsFormSchema.safeParse({
      category,
      title,
      content,
      ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      status,
      isPromoted,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setBusy(true)
    try {
      await createAdminNews(parsed.data)
      toast('Новину створено')
      reset()
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося створити новину')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-line p-4" aria-label="Створення новини">
      <div className="flex flex-wrap gap-2">
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Категорія">
          {NEWS_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')} aria-label="Статус публікації">
          <option value="published">{NEWS_STATUS_LABELS.published}</option>
          <option value="draft">{NEWS_STATUS_LABELS.draft}</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={isPromoted}
            onChange={(e) => setIsPromoted(e.target.checked)}
            aria-label="Промо-новина"
            className="accent-amber-500"
          />
          Промо
        </label>
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок (від 5 символів)" aria-label="Заголовок новини" />
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Текст (від 20 символів)" aria-label="Текст новини" />
      <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL зображення (опційно)" aria-label="URL зображення" />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Створюємо…' : 'Створити новину'}</Button>
    </form>
  )
}
