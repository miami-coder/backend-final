import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HangoutActions } from '@/components/features/hangouts/hangout-actions'
import { getMyHangouts } from '@/services/hangouts.server'
import { getMeSession } from '@/services/auth.server'
import { getSessionTokens } from '@/lib/auth/session'
import { HANGOUT_GENDERS, HANGOUT_PAYERS } from '@/lib/validation/hangout'
import { formatMoney } from '@/lib/utils/format'
import { parseHangout, HANGOUT_STATUS_LABELS, type RawHangout, type Hangout, type HangoutGender, type HangoutPayer } from '@/types/hangout'

const ROLES = ['created', 'joined', 'all'] as const

const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  created: 'Створені мною',
  joined: 'Приєднані',
  all: 'Усі',
}

// Лейбли — ті самі константи, що й у формі створення (hangout-button.tsx)
const genderLabel = (g: HangoutGender) => HANGOUT_GENDERS.find((x) => x.value === g)?.label ?? g
const payerLabel = (p: HangoutPayer) => HANGOUT_PAYERS.find((x) => x.value === p)?.label ?? p

// Рядок зустрічі (розмітка без змін — винесена для групування майбутні/минулі)
function HangoutItem({ h, userId }: { h: Hangout; userId: string }) {
  const isCreator = h.creatorId === userId
  // «Скасувати» — творець І статус open/filled (контракт компонента:
  // кнопку рендерить за isCreator, тому гейт статусів застосовано тут)
  const canCancel = isCreator && (h.status === 'open' || h.status === 'filled')
  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{h.date} · {h.time}</span>
        <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{HANGOUT_STATUS_LABELS[h.status]}</span>
        <Link className="ml-auto text-sm text-amber-500 hover:underline" href={`/hangouts/${h.id}`}>Деталі</Link>
      </div>
      <p className="mt-2 text-muted">{h.purpose}</p>
      <p className="mt-1 text-sm text-muted">
        {genderLabel(h.gender)} · до {h.groupSize} осіб · {payerLabel(h.payer)}{h.desiredBudget !== null ? ` · бюджет ${formatMoney(h.desiredBudget)}` : ''}
      </p>
      <div className="mt-3">
        <HangoutActions hangoutId={h.id} isCreator={canCancel} canLeave={!isCreator && h.status !== 'cancelled' && h.status !== 'completed'} />
      </div>
    </li>
  )
}

interface Props {
  searchParams: Promise<{ role?: string }>
}

export default async function MyHangoutsPage({ searchParams }: Props) {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/hangouts')
  const sp = await searchParams
  const role = ROLES.includes(sp?.role as (typeof ROLES)[number]) ? (sp?.role as (typeof ROLES)[number]) : 'created'

  const raw = await getMyHangouts(role, tokens)
  const hangouts = raw.map(parseHangout)
  const user = await getMeSession(tokens)

  // Групування за датою (h.date — 'YYYY-MM-DD', порівняння лексикографічне):
  // сьогоднішні й майбутні — «Майбутні», решта — «Минулі» (приглушені).
  // Порядок усередині груп — як віддає API, логіка запитів не змінена.
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = hangouts.filter((h) => h.date >= today)
  const past = hangouts.filter((h) => h.date < today)

  return (
    <section>
      <nav className="mb-4 flex gap-3 text-sm" aria-label="Роль у зустрічах">
        {ROLES.map((r) => (
          <Link
            key={r}
            href={`/account/hangouts?role=${r}`}
            className={r === role ? 'font-semibold text-amber-500' : 'text-muted hover:text-amber-500'}
          >
            {ROLE_LABELS[r]}
          </Link>
        ))}
      </nav>
      {hangouts.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-muted">Зустрічей немає.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-muted">Майбутні</h3>
              <ul className="space-y-3">
                {upcoming.map((h) => (
                  <HangoutItem key={h.id} h={h} userId={user.id} />
                ))}
              </ul>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-muted">Минулі</h3>
              {/* Минулі — приглушені рядки */}
              <ul className="space-y-3 opacity-60">
                {past.map((h) => (
                  <HangoutItem key={h.id} h={h} userId={user.id} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
