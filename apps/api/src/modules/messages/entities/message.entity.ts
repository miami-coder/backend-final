import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum MessageKind {
  /** Користувач → менеджер закладу */
  UserToManager = 'user_to_manager',
  /** Менеджер закладу → користувачу (відповідь) */
  ManagerReply = 'manager_reply',
  /** Зворотний зв'язок «написати нам» → скринька адмінки */
  Feedback = 'feedback',
  /** Відповідь адмінки на фідбек */
  FeedbackReply = 'feedback_reply',
  /** Системне повідомлення від «Пиячок» */
  System = 'system',
}

/** Вхідні для користувача: усе, що адресоване йому особисто. */
export const INBOX_KINDS = [
  MessageKind.ManagerReply,
  MessageKind.FeedbackReply,
  MessageKind.System,
] as const;

@Entity('messages')
@Index(['recipientId', 'isRead'])
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string;
  /** null — повідомлення від системи («Пиячок») */
  @Column({ type: 'uuid', nullable: true }) senderId: string | null;
  /** null — для kind=feedback: скринька адмінки */
  @Column({ type: 'uuid', nullable: true }) recipientId: string | null;
  @Column({ type: 'uuid', nullable: true }) venueId: string | null;
  @Column({ type: 'varchar', length: 32 }) kind: MessageKind;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'boolean', default: false }) isRead: boolean;
  @Column({ type: 'timestamptz', nullable: true }) readAt: Date | null;
  @CreateDateColumn() createdAt: Date;

  /** Маплені при читанні (leftJoin) — не колонки. */
  sender?: { firstname: string; lastname: string } | null;
  venue?: { id: string; name: string } | null;
}