'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { deleteHangout, hangoutAction } from '@/services/hangouts'
import { ApiError } from '@/lib/api/parse'

export function HangoutActions({ hangoutId, isCreator, canLeave, canDelete, leaveRedirect, onChanged, deleteRedirect }: {
  hangoutId: string
  isCreator: boolean
  canLeave: boolean
  /** Творець може і повністю видалити запит (не лише скасувати). */
  canDelete?: boolean
  /** Вказати — після «Покинути» перейти на адресу замість перевитягу поточної
   *  сторінки (деталі зустрічі → назад до списку зустрічей). */
  leaveRedirect?: string
  /** Клієнтська сторінка деталей не оновлюється через router.refresh —
   *  передає колбек перевитягу (наприклад, підйом attempt). Без пропа —
   *  звичний refresh (патерн кабінетних списків). */
  onChanged?: () => void
  /** Куди перейти після «Видалити» (дефолт — кабінетні зустрічі). */
  deleteRedirect?: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function act(kind: 'cancel' | 'leave') {
    setBusy(true)
    try {
      await hangoutAction(hangoutId, kind)
      // «Покинути» зі списку учасників: сторінка більше не актуальна для
      // цього користувача → замість перевитягу — перехід куди сказали
      if (kind === 'leave' && leaveRedirect) router.push(leaveRedirect)
      else if (onChanged) onChanged()
      else router.refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не вдалося виконати дію', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteHangout(hangoutId)
      toast('Запит видалено')
      router.push(deleteRedirect ?? '/account/hangouts')
      router.refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не вдалося видалити запит', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!isCreator && !canLeave && !canDelete) return null
  return (
    <div className="flex gap-2">
      {isCreator && (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => act('cancel')}>Скасувати</Button>
      )}
      {canLeave && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => act('leave')}>Покинути</Button>
      )}
      {canDelete && (
        <Button variant="danger" size="sm" disabled={busy} onClick={() => void remove()}>Видалити</Button>
      )}
    </div>
  )
}
