'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { hangoutAction } from '@/services/hangouts'
import { ApiError } from '@/lib/api/parse'

export function HangoutActions({ hangoutId, isCreator, canLeave, leaveRedirect }: {
  hangoutId: string
  isCreator: boolean
  canLeave: boolean
  /** Вказати — після «Покинути» перейти на адресу замість перевитягу поточної
   *  сторінки (деталі зустрічі → назад до списку зустрічей). */
  leaveRedirect?: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function act(kind: 'cancel' | 'leave') {
    setBusy(true)
    try {
      await hangoutAction(hangoutId, kind)
      // «Покинути» зі списку учасників: сторінка більше не актуальна для
      // цього користувача → замість перевитягу — перехід куди сказали (за
      // замовчуванням лишаємо звичний refresh — патерн кабінетних списків)
      if (kind === 'leave' && leaveRedirect) router.push(leaveRedirect)
      else router.refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не вдалося виконати дію', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!isCreator && !canLeave) return null
  return (
    <div className="flex gap-2">
      {isCreator && (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => act('cancel')}>Скасувати</Button>
      )}
      {canLeave && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => act('leave')}>Покинути</Button>
      )}
    </div>
  )
}
