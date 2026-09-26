import { serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseMessage, type RawMessage } from '@/types/message'
import { formatDate } from '@/lib/utils/format'
import { Pagination } from '@/components/ui/pagination'
import { AdminFeedbackReply } from '@/components/features/admin/admin-feedback-reply'

export const revalidate = 0

const LIMIT = 20

interface Props {
  searchParams: Promise<{ page?: string }>
}

// Скринька зворотного зв'язку «написати нам» (пункт ТЗ 11): форма /contact
// створює kind=feedback; тут суперадмін дивиться список і відповідає —
// відповідь потрапляє у вхідні автора (дзвіночок у хедері).
export default async function AdminMessagesPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)

  const tokens = await getSessionTokens()
  const list = await serverFetchList<RawMessage>(`/admin/messages/feedback?page=${page}&limit=${LIMIT}`, {
    tokens,
    revalidate: 0,
  })
  const messages = list.data.map(parseMessage)
  const totalPages = Math.max(1, Math.ceil((list.meta?.total ?? 0) / (list.meta?.limit || LIMIT)))

  return (
    <section aria-label="Зворотний звʼязок" className="space-y-4">
      <p className="text-sm text-muted">
        Повідомлення з форми «Написати нам» (/contact). Відповідь потрапить користувачу у Повідомлення.
      </p>
      {messages.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          Повідомлень немає.
        </p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-ink">{m.senderName ?? 'Користувач'}</span>
                <span className="text-sm text-muted">{formatDate(m.createdAt)}</span>
                <div className="ml-auto">
                  <AdminFeedbackReply feedbackId={m.id} />
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/admin/messages?page=${p}`} />
    </section>
  )
}