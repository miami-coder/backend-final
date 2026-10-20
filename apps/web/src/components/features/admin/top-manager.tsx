'use client'

// Редагування Топу супер-адміном (revʼю викладача): категорії + записи.
// Серверний пейдж не юзається — список перезавантажується router.refresh().

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApiError } from '@/lib/api/client'
import {
  addTopEntry,
  createTopCategory,
  deleteTopCategory,
  removeTopEntry,
  type TopCategoryAdmin,
} from '@/services/venues'
import { useToast } from '@/components/ui/toast'

export function TopManager({ categories }: { categories: TopCategoryAdmin[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [busyCat, setBusyCat] = useState<string | null>(null)
  // Ревʼю Stage 4 M1: спільний venueId-стан дзеркалився в усі категорії —
  // тепер у кожної категорії свій інпут
  const [entryInputs, setEntryInputs] = useState<Record<string, string>>({})

  async function run(fn: () => Promise<unknown>, done: string) {
    try {
      await fn()
      toast(done)
      router.refresh()
    } catch (e) {
      toast(authApiError(e) ?? 'Помилка', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          void run(() => createTopCategory(title.trim()), 'Категорію створено').then(() => {
            setTitle('')
          })
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Назва категорії, напр. «Найкращий заклад для весілля»"
          aria-label="Назва категорії Топу"
          className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-amber-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-espresso hover:bg-amber-400"
        >
          Додати категорію
        </button>
      </form>

      {categories.length === 0 && (
        <p className="text-sm text-faint">Категорій Топу ще нема.</p>
      )}

      <ul className="space-y-4">
        {categories.map((c, i) => (
          <li key={c.id} className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium text-ink">
                {i + 1}. {c.title}
              </h3>
              <button
                type="button"
                disabled={busyCat === c.id}
                onClick={() => {
                  if (busyCat) return
                  setBusyCat(c.id)
                  void run(() => deleteTopCategory(c.id), 'Категорію видалено').finally(
                    () => setBusyCat(null),
                  )
                }}
                className="rounded-xl border border-line px-3 py-1.5 text-sm hover:border-red-500 hover:text-red-500 disabled:opacity-50"
              >
                Видалити категорію
              </button>
            </div>

            <ol className="mt-3 space-y-1">
              {(c.entries ?? []).length === 0 && (
                <li className="text-sm text-faint">Тимчасово порожньо</li>
              )}
              {(c.entries ?? []).map((e, place) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-right font-bold text-amber-500">{place + 1}</span>
                  <span className="text-ink">{e.venue?.name ?? e.venueId}</span>
                  <button
                    type="button"
                    onClick={() => void run(() => removeTopEntry(c.id, e.id), 'Прибрано з Топу')}
                    className="ml-auto text-xs text-muted hover:text-red-500"
                  >
                    прибрати
                  </button>
                </li>
              ))}
            </ol>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const idValue = (entryInputs[c.id] ?? '').trim()
                if (!idValue) return
                void run(() => addTopEntry(c.id, idValue), 'Заклад додано').then(
                  () => setEntryInputs((m) => ({ ...m, [c.id]: '' })),
                )
              }}
            >
              <input
                value={entryInputs[c.id] ?? ''}
                onChange={(e) =>
                  setEntryInputs((m) => ({ ...m, [c.id]: e.target.value }))
                }
                placeholder="UUID закладу (див. каталог адмінки)"
                aria-label={`UUID закладу для категорії ${c.title}`}
                className="flex-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus-visible:border-amber-500"
              />
              <button
                type="submit"
                className="rounded-xl border border-line px-3 py-1.5 text-xs hover:border-amber-500 hover:text-amber-500"
              >
                Додати в Топ
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  )
}