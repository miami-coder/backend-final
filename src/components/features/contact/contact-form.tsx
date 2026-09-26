'use client'

// Форма зворотного зв'язку «Написати нам»: POST /feedback → скринька
// адмінки (GET /admin/messages/feedback). Відповідь адмінки потрапляє
// користувачу у вхідні (дзвіночок у хедері). Гостю — лінк на логін.

import Link from 'next/link'
import { useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { messageFormSchema } from '@/lib/validation/message'

export function ContactForm() {
  const { user } = useUser()
  const { toast } = useToast()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (!user) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-sm">
        <p className="text-muted">
          Щоб написати нам, спершу увійдіть — так ми зможемо відповісти вам у розділі
          «Повідомлення».
        </p>
        <Link
          href="/auth/login?next=/contact"
          className="mt-3 inline-flex items-center rounded-xl bg-amber-500 px-4 py-2 text-[13px] font-medium text-espresso hover:bg-amber-400"
        >
          Увійти
        </Link>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = messageFormSchema.safeParse({ body })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSending(true)
    try {
      await api('/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      toast('Повідомлення надіслано. Відповідь прийде у ваші Повідомлення.')
      setBody('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Сервіс тимчасово недоступний')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-surface p-6">
      <label className="block text-sm">
        Ваше повідомлення команді Пиячка
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Питання, пропозиція або проблема — напишіть все тут"
          aria-label="Текст повідомлення"
          className="mt-1"
        />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={sending}>
        {sending ? 'Надсилаємо…' : 'Надіслати'}
      </Button>
      <p className="text-sm text-muted">
        Відповідь прийде у розділ <Link className="text-amber-500 hover:underline" href="/account/messages">Повідомлення</Link>.
      </p>
    </form>
  )
}