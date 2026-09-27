'use client'

// Скринька власника закладу (вкладка «Повідомлення»): список user_to_manager
// від користувачів + відповідь модалкою → POST /me/venues/:venueId/messages/:id/reply.
// Список фетчить серверна вкладка page.tsx і приходить пропом; успіх → toast
// + router.refresh().

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { replyToVenueMessage } from '@/services/messages'
import { ApiError } from '@/lib/api/parse'
import { messageFormSchema } from '@/lib/validation/message'
import { formatDate } from '@/lib/utils/format'
import type { Message } from '@/types/message'

export function VenueMessagesManager({
  venueId,
  messages,
}: {
  venueId: string
  messages: Message[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [replying, setReplying] = useState<Message | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submitReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replying) return
    setError(null)
    const parsed = messageFormSchema.safeParse({ body })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSending(true)
    try {
      await replyToVenueMessage(venueId, replying.id, parsed.data)
      toast('Відповідь надіслано — користувач побачить її у своїх повідомленнях.')
      setReplying(null)
      setBody('')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося надіслати відповідь')
    }
  }

  return (
    <section aria-label="Повідомлення користувачів">
      <p className="mb-3 text-sm text-muted">
        Тут зʼявляються повідомлення користувачів про ваш заклад (кнопка «Написати менеджеру»).
        Відповідь потрапить у вхідні автора.
      </p>
      {messages.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          Повідомлень ще немає.
        </p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-ink">{m.senderName ?? 'Користувач'}</span>
                <span className="text-sm text-muted">{formatDate(m.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{m.body}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setReplying(m)
                  setBody('')
                  setError(null)
                }}
              >
                Відповісти
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={replying !== null} onClose={() => setReplying(null)} title="Відповісти користувачу">
        {replying && (
          <form onSubmit={submitReply} className="space-y-3">
            <p className="text-sm text-muted">
              {replying.senderName ?? 'Користувач'}: «{replying.body.slice(0, 120)}
              {replying.body.length > 120 ? '…' : ''}»
            </p>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Текст відповіді"
              aria-label="Текст відповіді"
            />
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setReplying(null)}>
                Скасувати
              </Button>
              <Button type="submit" disabled={sending}>
                {sending ? 'Надсилаємо…' : 'Надіслати відповідь'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  )
}