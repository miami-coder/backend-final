'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { hangoutAction } from '@/services/hangouts'
import { ApiError } from '@/lib/api/parse'

// Дія виконується одразу натисканням кнопки (контракт тесту: один клік →
// POST → router.refresh()). Статус-гейт «open/filled» для «Скасувати»
// застосовує СТОРІНКА — компонент лише рендерить кнопки за пропсами.
export function HangoutActions({ hangoutId, isCreator, canLeave }: { hangoutId: string; isCreator: boolean; canLeave: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function act(kind: 'cancel' | 'leave') {
    setBusy(true)
    try {
      await hangoutAction(hangoutId, kind)
      router.refresh()
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
