'use client'

// Відповідь суперадміна на зворотний зв'язок: POST /admin/messages/feedback/:id/reply
// → користувачу у вхідні (kind=feedback_reply).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { messageFormSchema } from '@/lib/validation/message'

export function AdminFeedbackReply({ feedbackId }: { feedbackId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

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
      await api(`/admin/messages/feedback/${feedbackId}/reply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      toast('Відповідь надіслано користувачу')
      setOpen(false)
      setBody('')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося надіслати відповідь')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Відповісти
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Відповісти на зворотний звʼязок">
        <form onSubmit={submit} className="space-y-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Текст відповіді"
            aria-label="Текст відповіді"
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