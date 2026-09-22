'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { HangoutActions } from '@/components/features/hangouts/hangout-actions'
import { HangoutJoinButton } from '@/components/features/hangouts/hangout-join-button'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { parseHangout, HANGOUT_STATUS_LABELS, type RawHangout, type Hangout } from '@/types/hangout'
import { formatMoney } from '@/lib/utils/format'
// Лейбли gender/payer — ті самі константи, що й у формі створення/кабінеті (єдине джерело копірайту)
import { HANGOUT_GENDERS, HANGOUT_PAYERS } from '@/lib/validation/hangout'
import { useUser } from '@/components/providers/user-provider'

interface DetailState {
  id: string
  hangout: Hangout | null
  error: string | null
}

// Клієнтська сторінка деталей: api()-фетч (401 → auto-redirect всередині
// клієнта, 403 → error-стан). Loading → контент | помилка з retry.
// Стан — один об'єкт з id-міткою: loading виводиться (id не збігся або ще
// немає ані даних, ані помилки), бо sync setState у useEffect забороняє
// lint-правило react-hooks/set-state-in-effect. Retry (event handler) скидає
// дані і підіймає attempt → ефект перевитягує.
export default function HangoutDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const [state, setState] = useState<DetailState>({ id, hangout: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<RawHangout>(`/hangouts/${id}`)
      .then((raw) => { if (!cancelled) setState({ id, hangout: parseHangout(raw), error: null }) })
      .catch((e) => { if (!cancelled) setState({ id, hangout: null, error: e instanceof ApiError ? e.message : 'Не вдалося завантажити зустріч' }) })
    return () => { cancelled = true }
  }, [id, attempt])

  const fresh = state.id === id
  const hangout = fresh ? state.hangout : null
  const error = fresh ? state.error : null
  const loading = !fresh || (hangout === null && error === null)

  if (loading) return <p className="py-8 text-center text-muted">Завантаження…</p>
  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted">{error}</p>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => { setState({ id, hangout: null, error: null }); setAttempt((n) => n + 1) }}
        >
          Повторити
        </Button>
        <p className="mt-3"><Link href="/hangouts" className="text-amber-500 hover:underline">До списку зустрічей</Link></p>
      </div>
    )
  }
  if (!hangout) return null

  const participants = hangout.participants ?? []
  const isCreator = user?.id === hangout.creatorId
  const isParticipant = participants.some((p) => p.userId === user?.id)
  // Контролер-інструкція (леджер Task 6): HangoutActions рендерить «Скасувати»
  // з пропа isCreator без урахування статусу — для творця скасованої/завершеної
  // зустрічі кнопку показувати не можна. Гейт застосовує СТОРІНКА: isCreator
  // передається лише поки статус активний (open/filled); canLeave вже виключає
  // cancelled/completed, тож для неактивної зустрічі HangoutActions → null.
  const isCreatorActive = isCreator && (hangout.status === 'open' || hangout.status === 'filled')

  return (
    <article className="mx-auto max-w-2xl py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">{hangout.date} · {hangout.time}</h1>
        <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{HANGOUT_STATUS_LABELS[hangout.status]}</span>
      </div>
      <p className="mt-2 text-muted">{hangout.purpose}</p>
      <ul className="mt-4 space-y-1 text-sm text-muted">
        <li>Учасників потрібно: до {hangout.groupSize}</li>
        <li>{HANGOUT_GENDERS.find((g) => g.value === hangout.gender)?.label}</li>
        <li>{HANGOUT_PAYERS.find((p) => p.value === hangout.payer)?.label}</li>
        {hangout.desiredBudget !== null && <li>Бюджет: {formatMoney(hangout.desiredBudget)}</li>}
        {hangout.venue && (
          <li>Заклад: <Link className="text-amber-500 hover:underline" href={`/venues/${hangout.venue.id}`}>{hangout.venue.name}</Link></li>
        )}
      </ul>

      <div className="mt-6">
        <h2 className="font-display text-lg font-semibold">Учасники ({participants.length})</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {participants.map((p) => (
            <li key={p.userId}>Учасник (приєднався {p.joinedAt?.slice(0, 10)})</li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex items-center gap-3">
        {!isParticipant && <HangoutJoinButton hangoutId={hangout.id} status={hangout.status} />}
        <HangoutActions
          hangoutId={hangout.id}
          isCreator={isCreatorActive}
          canLeave={Boolean(user) && !isCreator && hangout.status !== 'cancelled' && hangout.status !== 'completed'}
        />
        <Link href="/hangouts" className="text-sm text-muted hover:underline">До списку</Link>
      </div>
    </article>
  )
}
