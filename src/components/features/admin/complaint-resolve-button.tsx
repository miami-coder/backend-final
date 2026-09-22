'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, authApiError } from '@/lib/api/client'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'

// Вирішення скарги: статус (за замовчуванням resolved) + optional note.
// Порожню примітку (й «пробільну») не шлемо взагалі — бекенд очікує або
// { status }, або { status, note }. Помилка (у т.ч. 409 «вже вирішено»)
// показується inline у модалці, щоб можна було повторити спробу.
export function ComplaintResolveButton({ complaintId }: { complaintId: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'resolved' | 'rejected'>('resolved')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  function openModal() {
    setStatus('resolved')
    setNote('')
    setError(null)
    setOpen(true)
  }

  async function resolve() {
    if (busy) return // in-flight гард: подвійний клік не шле другий запит
    setBusy(true)
    setError(null)
    const trimmed = note.trim()
    try {
      await api(`/admin/complaints/${complaintId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmed ? { status, note: trimmed } : { status }),
      })
      toast('Скаргу вирішено')
      router.refresh()
      setOpen(false)
    } catch (e) {
      // помилка (у т.ч. 409): inline у модалці — вона лишається відкритою
      setError(authApiError(e) ?? 'Не вдалося вирішити скаргу')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full border border-strong px-3 py-1.5 text-sm text-muted hover:bg-raised"
      >
        Вирішити
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Вирішити скаргу">
        <div role="radiogroup" aria-label="Статус вирішення" className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="radio"
              name={`complaint-status-${complaintId}`}
              value="resolved"
              checked={status === 'resolved'}
              onChange={() => setStatus('resolved')}
              className="accent-amber-500"
            />
            Вирішено (resolved)
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="radio"
              name={`complaint-status-${complaintId}`}
              value="rejected"
              checked={status === 'rejected'}
              onChange={() => setStatus('rejected')}
              className="accent-amber-500"
            />
            Відхилено (rejected)
          </label>
        </div>
        <label htmlFor={`complaint-note-${complaintId}`} className="mt-3 block text-sm text-muted">
          Примітка (необовʼязково)
        </label>
        <textarea
          id={`complaint-note-${complaintId}`}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-xl border border-strong bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-amber-500 focus:outline-none"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void resolve()}
            disabled={busy}
            className="rounded-full bg-amber-500 px-3 py-1.5 text-sm font-medium text-espresso hover:bg-amber-400 disabled:opacity-50"
          >
            Зберегти
          </button>
        </div>
      </Modal>
    </>
  )
}
