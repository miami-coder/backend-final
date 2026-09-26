'use client'

// Кнопка «Написати менеджеру» на сторінці закладу: модалка з textarea →
// POST /venues/:id/messages (бекенд адресує власнику закладу). Гість — лінк
// на логін із поверненням (патерн ComplaintButton/FavoriteButton).

import Link from 'next/link'
import { useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { messageFormSchema } from '@/lib/validation/message'

export function MessageToManagerButton({
  venueId,
  label = 'Написати менеджеру',
}: {
  venueId: string
  label?: string
}) {
  const { user } = useUser()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (!user) {
    // слеші в route-значенні безпечні — патерн FavoriteButton/ReviewForm
    return (
      <Link
        href={`/auth/login?next=/venues/${venueId}`}
        className="inline-flex items-center rounded-xl border border-strong px-4 py-2 text-sm hover:bg-raised"
      >
        ✉ {label}
      </Link>
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
      await api(`/venues/${venueId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      toast('Повідомлення надіслано менеджеру закладу.')
      setOpen(false)
      setBody('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Сервіс тимчасово недоступний')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        ✉ {label}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Повідомлення менеджеру закладу">
        <form onSubmit={submit} className="space-y-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ваше питання або прохання до менеджера"
            aria-label="Текст повідомлення"
          />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? 'Надсилаємо…' : 'Надіслати'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}