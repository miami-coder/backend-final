'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { COMPLAINT_REASONS, complaintFormSchema } from '@/lib/validation/complaint'

interface Props {
  target: { venueId?: string; reviewId?: string }
  label?: string
  // куди повернути гостя після логіна; за замовчуванням — сторінка закладу,
  // або «/» для reviewId-цілі (окремої сторінки відгуку в маршрутах немає)
  loginNext?: string
}

export function ComplaintButton({ target, label = 'Скарга', loginNext }: Props) {
  const { user } = useUser()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<'fake_promo' | 'fraud' | 'other'>('other')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const loginPath = loginNext ?? (target.venueId ? `/venues/${target.venueId}` : '/')

  if (!user) {
    return (
      // без encodeURIComponent: %2F у next проксі відкидає (нормалізація шляху),
      // а слеші в route-значенні безпечні — патерн FavoriteButton/ReviewForm
      <Link
        href={`/auth/login?next=${loginPath}`}
        className="inline-flex items-center rounded-xl border border-strong px-4 py-2 text-sm hover:bg-raised"
      >
        ⚑ {label}
      </Link>
    )
  }

  async function submit() {
    setError(null)
    // target — із пропсів (не з інпуту), тому ''-нормалізація не потрібна
    const parsed = complaintFormSchema.safeParse({ ...target, reason, text })
    if (!parsed.success) {
      // помилки полів DTO на поля не маппимо — message першого issue інлайн
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSending(true)
    try {
      await api('/complaints', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      toast('Скаргу надіслано. Модератори розглянуть її.')
      setOpen(false)
      setText('')
      setReason('other')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Сервіс тимчасово недоступний')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        ⚑ {label}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Подати скаргу">
        <div className="space-y-3">
          <div className="text-sm">
            <label htmlFor="complaint-reason" className="mb-1 block">
              Причина
            </label>
            <select
              id="complaint-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="w-full rounded-xl border border-strong bg-bg px-3 py-2 text-ink focus:border-amber-500 focus:outline-none"
            >
              {COMPLAINT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="text-sm">
            <label htmlFor="complaint-text" className="mb-1 block">
              Опис (мінімум 20 символів)
            </label>
            <Textarea
              id="complaint-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Опишіть проблему детально"
            />
          </div>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button type="button" variant="primary" onClick={submit} disabled={sending}>
              Надіслати скаргу
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
