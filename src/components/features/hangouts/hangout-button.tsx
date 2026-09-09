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
import { HANGOUT_GENDERS, HANGOUT_PAYERS, hangoutFormSchema } from '@/lib/validation/hangout'

const ACK_KEY = 'hangout-safety-ack'

// «Сьогодні» для min-атрибути інпута — за ЛОКАЛЬНОЮ зоною (en-CA → YYYY-MM-DD),
// та сама логіка, що й у схемі (фікс Task 8): toISOString() дав би UTC.
const localToday = () =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export function HangoutButton({ venueId, loginNext }: { venueId: string; loginNext: string }) {
  const { user } = useUser()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  // читаємо прапор підтвердження безпеки одразу в ініціалізаторі:
  // на SSR localStorage кидає ReferenceError — try/catch дає false
  const [ack, setAck] = useState(() => {
    try {
      return localStorage.getItem(ACK_KEY) === '1'
    } catch {
      return false
    }
  })

  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [purpose, setPurpose] = useState('')
  const [gender, setGender] = useState<'any' | 'male' | 'female'>('any')
  const [groupSize, setGroupSize] = useState('2')
  const [payer, setPayer] = useState<'me' | 'split' | 'them'>('me')
  const [desiredBudget, setDesiredBudget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (!user) {
    return (
      // без encodeURIComponent: %2F у next проксі відкидає (нормалізація шляху),
      // а слеші в route-значенні безпечні — патерн FavoriteButton/ReviewForm/ComplaintButton
      <Link
        href={`/auth/login?next=${loginNext}`}
        className="inline-flex items-center rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
      >
        🍻 Знайти пиячку
      </Link>
    )
  }

  // Спека §5: підтвердження безпеки — один раз, у localStorage.
  // Приватний режим без localStorage: попередження показуватиметься щоразу, це ок.
  function acknowledge() {
    try {
      localStorage.setItem(ACK_KEY, '1')
    } catch {
      // свідомо ігноруємо — безпековий крок просто не запам'ятовується
    }
    setAck(true)
  }

  async function submit() {
    setError(null)
    const parsed = hangoutFormSchema.safeParse({
      date,
      time,
      purpose,
      gender,
      groupSize,
      payer,
      // пусте поле бюджету не надсилаємо: '' через coerce став би 0
      ...(desiredBudget !== '' ? { desiredBudget } : {}),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSending(true)
    try {
      await api(`/venues/${venueId}/hangouts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      toast('Пиячок створено! Очікуйте на компанію.')
      setOpen(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Сервіс тимчасово недоступний')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        🍻 Знайти пиячку
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Знайти пиячку">
        {!ack ? (
          // Спека §5: ПЕРШИЙ крок модалки — попередження про безпеку
          <div className="space-y-4">
            <h3 className="font-semibold text-amber-700">⚠️ Попередження про безпеку</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-stone-700">
              <li>Ви зустрічаєтеся з незнайомими людьми. Обирайте публічні місця.</li>
              <li>Ніколи не пересилайте гроші незнайомцям до зустрічі.</li>
              <li>Повідомте близьких, куди йдете та на який час.</li>
              <li>Якщо щось викликає підозру — скасуйте зустріч.</li>
            </ul>
            <Button type="button" variant="primary" onClick={acknowledge}>
              Зрозуміло, продовжити
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-sm">
                <label htmlFor="hg-date" className="mb-1 block">Дата</label>
                <input
                  id="hg-date"
                  type="date"
                  min={localToday()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
              <div className="text-sm">
                <label htmlFor="hg-time" className="mb-1 block">Час</label>
                <input
                  id="hg-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="text-sm">
              <label htmlFor="hg-purpose" className="mb-1 block">
                Мета зустрічі (10-500 символів)
              </label>
              <Textarea
                id="hg-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Наприклад: дегустація крафтового пива, настільні ігри…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-sm">
                <label htmlFor="hg-gender" className="mb-1 block">Компанія</label>
                <select
                  id="hg-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as typeof gender)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                >
                  {HANGOUT_GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div className="text-sm">
                <label htmlFor="hg-size" className="mb-1 block">Розмір групи (1-20)</label>
                <input
                  id="hg-size"
                  type="number"
                  min={1}
                  max={20}
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-sm">
                <label htmlFor="hg-payer" className="mb-1 block">Хто платить</label>
                <select
                  id="hg-payer"
                  value={payer}
                  onChange={(e) => setPayer(e.target.value as typeof payer)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                >
                  {HANGOUT_PAYERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="text-sm">
                <label htmlFor="hg-budget" className="mb-1 block">Бажаний чек (₴, опційно)</label>
                <input
                  id="hg-budget"
                  type="number"
                  min={0}
                  max={100000}
                  value={desiredBudget}
                  onChange={(e) => setDesiredBudget(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Скасувати
              </Button>
              <Button type="button" variant="primary" onClick={submit} disabled={sending}>
                Створити пиячок
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
