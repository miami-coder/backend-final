// Повідомлення (модуль messages бекенда): user_to_manager — власне надіслане
// менеджеру; вхідні користувача — manager_reply / feedback_reply / system.
// sender/venue бекенд мапить при читанні (leftJoin) — можуть бути відсутні.

export type MessageKind =
  | 'user_to_manager'
  | 'manager_reply'
  | 'feedback'
  | 'feedback_reply'
  | 'system'

export const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  user_to_manager: 'Ваше повідомлення менеджеру',
  manager_reply: 'Відповідь менеджера',
  feedback: 'Зворотний звʼязок',
  feedback_reply: 'Відповідь Пиячка',
  system: 'Пиячок',
}

export interface RawMessage {
  id: string
  senderId: string | null
  recipientId: string | null
  venueId: string | null
  kind: MessageKind
  body: string
  isRead: boolean
  readAt: string | null
  createdAt: string
  sender?: { firstname: string; lastname: string } | null
  venue?: { id: string; name: string } | null
}

export interface Message {
  id: string
  senderId: string | null
  venueId: string | null
  kind: MessageKind
  body: string
  isRead: boolean
  createdAt: string
  senderName: string | null
  venueName: string | null
}

function senderName(raw: RawMessage): string | null {
  const p = raw.sender
  if (!p || (!p.firstname && !p.lastname)) return null
  return [p.firstname, p.lastname].filter(Boolean).join(' ')
}

export function parseMessage(raw: RawMessage): Message {
  return {
    id: raw.id,
    senderId: raw.senderId ?? null,
    venueId: raw.venueId ?? null,
    kind: raw.kind,
    body: raw.body,
    isRead: Boolean(raw.isRead),
    createdAt: raw.createdAt,
    senderName: senderName(raw),
    venueName: raw.venue?.name ?? null,
  }
}