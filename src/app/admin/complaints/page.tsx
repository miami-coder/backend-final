import { serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseComplaint, type RawComplaint } from '@/types/admin'
import { COMPLAINT_REASONS } from '@/lib/validation/complaint'
import { formatDate } from '@/lib/utils/format'
import { Pagination } from '@/components/ui/pagination'
import { ComplaintResolveButton } from '@/components/features/admin/complaint-resolve-button'

export const revalidate = 0

const LIMIT = 20

interface Props {
  searchParams: Promise<{ page?: string }>
}

// Скарги: черга New/InReview. Relations бекенд не повертає — ціль рендеримо
// текстом («Заклад»/«Відгук»/«—»), без посилань; довгий text обрізаємо до 140.
export default async function AdminComplaintsPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)

  const tokens = await getSessionTokens()
  const list = await serverFetchList<RawComplaint>(`/admin/complaints?page=${page}`, {
    tokens,
    revalidate: 0,
  })
  const complaints = list.data.map(parseComplaint)
  // meta без totalPages — рахуємо з total/limit (бекендова limit, інакше LIMIT)
  const totalPages = Math.max(1, Math.ceil((list.meta?.total ?? 0) / (list.meta?.limit || LIMIT)))

  return (
    <section aria-label="Скарги" className="space-y-4">
      {complaints.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">Скарг немає.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {complaints.map((c) => (
            <li key={c.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* бейдж причини: невідомий код (парсер зводить до 'other',
                    але COMPLAINT_REASONS може відстати) → «Інше» */}
                <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                  {COMPLAINT_REASONS.find((r) => r.value === c.reason)?.label ?? 'Інше'}
                </span>
                <span className="text-sm text-muted">{c.venueId ? 'Заклад' : c.reviewId ? 'Відгук' : '—'}</span>
                <span className="ml-auto text-xs text-faint">{formatDate(c.createdAt)}</span>
              </div>
              {/* Текст скарги. Цитату оскарженого відгуку бекенд не віддає
                  (relations відсутні) — вкладений блок цитати не рендеримо */}
              <p className="mt-2 flex-1 text-sm text-ink">
                {c.text.length > 140 ? c.text.slice(0, 140) + '…' : c.text}
              </p>
              <div className="mt-3 flex justify-end border-t border-line pt-3">
                <ComplaintResolveButton complaintId={c.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* Pagination сам повертає null при totalPages <= 1 */}
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/admin/complaints?page=${p}`} />
    </section>
  )
}
