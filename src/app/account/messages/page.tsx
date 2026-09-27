'use client'

// Вхідні повідомлення (дзвіночок → сюди): GET /me/messages (пагінація),
// клік по непрочитаному → PATCH /me/messages/:id/read. Сторінка клієнтська:
// api()/apiList() самі редіректять на логін при 401.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getMyMessages, markMessageRead } from '@/services/messages'
import { ApiError } from '@/lib/api/parse'
import { MESSAGE_KIND_LABELS, parseMessage, type Message } from '@/types/message'
import { formatDate } from '@/lib/utils/format'

const LIMIT = 20

export default function AccountMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: number) => {
    setError(null)
    try {
      const list = await getMyMessages(p, LIMIT)
      setMessages(list.data.map(parseMessage))
      setTotal(list.meta?.total ?? list.data.length)
      setPage(p)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити повідомлення')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(1)
  }, [load])

  async function markRead(m: Message) {
    if (m.isRead) return
    try {
      await markMessageRead(m.id)
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, isRead: true } : x)))
    } catch {
      // не критично: позначка читання повториться при наступному кліку
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <section aria-label="Повідомлення" className="space-y-4">
      <h2 className="font-display text-lg font-semibold">Повідомлення</h2>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {loading ? null : messages.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          Повідомлень ще немає.
        </p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-xl border p-4 ${m.isRead ? 'border-line bg-surface' : 'border-amber-500/50 bg-surface'}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
                  {MESSAGE_KIND_LABELS[m.kind]}
                </span>
                {m.venueName && (
                  <Link href={`/venues/${m.venueId}`} className="text-sm text-amber-500 hover:underline">
                    {m.venueName}
                  </Link>
                )}
                {m.senderName && <span className="text-sm text-muted">{m.senderName}</span>}
                <span className="text-sm text-muted">{formatDate(m.createdAt)}</span>
                {!m.isRead && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-400">Нове</span>}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{m.body}</p>
              {!m.isRead && (
                <Button variant="ghost" size="sm" onClick={() => void markRead(m)}>
                  Позначити прочитаним
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="flex gap-3 text-sm">
          {page > 1 && (
            <Button variant="secondary" size="sm" onClick={() => void load(page - 1)}>
              ← Попередня
            </Button>
          )}
          {page < totalPages && (
            <Button variant="secondary" size="sm" onClick={() => void load(page + 1)}>
              Наступна →
            </Button>
          )}
        </div>
      )}
    </section>
  )
}