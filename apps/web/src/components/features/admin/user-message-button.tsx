'use client'

// Системне повідомлення від «Пиячок» користувачу (з деталки користувача
// в адмінці): POST /admin/users/:id/message → kind=system у вхідних.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { messageAdminUser } from '@/services/users'
import { ApiError } from '@/lib/api/parse'
import { messageFormSchema } from '@/lib/validation/message'

export function UserMessageButton({ userId }: { userId: string }) {
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
      await messageAdminUser(userId, parsed.data)
      toast('Системне повідомлення надіслано')
      setOpen(false)
      setBody('')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося надіслати повідомлення')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        ✉ Написати від Пиячка
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Повідомлення від «Пиячок»">
        <form onSubmit={submit} className="space-y-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Текст системного повідомлення"
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