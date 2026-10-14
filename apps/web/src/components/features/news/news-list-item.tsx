// Рядок новини у стрічці — спільний для /news і для секції новин закладу.
// Клік по рядку веде на деталку новини (/news/:id), де живуть теги та лінк на заклад.

import Link from 'next/link'
import { NEWS_CATEGORIES } from '@/lib/validation/news'
import { placeholderFor } from '@/lib/utils/placeholder'
import type { News } from '@/types/news'

// Датаблок «редакторської стрічки»: день великим + місяць капсом окремо
// (Intl uk-UA; «вер.» → «ВЕР» — без крапки, капсом)
const dayFmt = new Intl.DateTimeFormat('uk-UA', { day: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('uk-UA', { month: 'short' })
function dateParts(iso: string): { day: string; month: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { day: '—', month: '' }
  return { day: dayFmt.format(d), month: monthFmt.format(d).replace('.', '').toUpperCase() }
}

export function NewsListItem({ item }: { item: News }) {
  // невідома категорія з бекенда → бейдж узагалі не рендеримо (порожній span недопустимий)
  const categoryLabel = NEWS_CATEGORIES.find((c) => c.value === item.category)?.label
  const { day, month } = dateParts(item.publishedAt ?? item.createdAt)
  return (
    <li className="border-b border-line">
      <Link href={`/news/${item.id}`} className="flex items-center gap-4 py-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-raised">
          <span className="font-display text-xl font-bold leading-none text-amber-400">{day}</span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wide text-faint">{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-ink">{item.title}</h3>
          {item.content && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{item.content}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {item.isPromoted && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-400">Промо</span>}
            {categoryLabel && (
              <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{categoryLabel}</span>
            )}
          </div>
        </div>
        <div className="aspect-[4/3] w-[120px] shrink-0 overflow-hidden rounded-xl">
          {item.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
            <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div style={{ background: placeholderFor(item.id) }} className="h-full w-full" />
          )}
        </div>
      </Link>
    </li>
  )
}