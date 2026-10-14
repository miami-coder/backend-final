import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Message, MessageKind, INBOX_KINDS } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { VenuesService } from '../venues/venues.service';
import { PermissionsService } from '../rbac/permissions.service';
import { Profile } from '../users/entities/profile.entity';
import { Venue } from '../venues/entities/venue.entity';
import {
  buildMeta,
  normalizePagination,
} from '../../common/utils/pagination.util';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly venues: VenuesService,
    private readonly perms: PermissionsService,
  ) {}

  /** Користувач пише менеджеру (власнику) закладу. */
  async sendToVenueManager(userId: string, venueId: string, dto: SendMessageDto) {
    const venue = await this.venues.findOneOrThrow(venueId);
    return this.save({
      senderId: userId,
      recipientId: venue.ownerId,
      venueId,
      kind: MessageKind.UserToManager,
      body: dto.body,
    });
  }

  /** Менеджер закладу відповідає на повідомлення користувача. */
  async replyToVenueMessage(
    managerId: string,
    venueId: string,
    messageId: string,
    dto: SendMessageDto,
  ) {
    const message = await this.getOwnVenueMessage(managerId, venueId, messageId);
    return this.save({
      senderId: managerId,
      recipientId: message.senderId,
      venueId,
      kind: MessageKind.ManagerReply,
      body: dto.body,
    });
  }

  /** Скринька власника закладу: повідомлення користувачів про цей заклад. */
  async listVenueInbox(
    managerId: string,
    venueId: string,
    opts: { page?: number; limit?: number },
  ) {
    const venue = await this.venues.findOneOrThrow(venueId);
    await this.assertCanManageVenue(managerId, venue);
    const { page, limit, offset } = normalizePagination(opts);
    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndMapOne(
        'm.sender',
        Profile,
        'p',
        'p."userId" = m."senderId"',
      )
      .where('m.venueId = :venueId', { venueId })
      .andWhere('m.kind = :kind', { kind: MessageKind.UserToManager })
      .orderBy('m.createdAt', 'DESC')
      .skip(offset)
      .take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  /** Зворотний зв'язок «написати нам». */
  async sendFeedback(userId: string, dto: SendMessageDto) {
    return this.save({
      senderId: userId,
      recipientId: null,
      venueId: null,
      kind: MessageKind.Feedback,
      body: dto.body,
    });
  }

  /** Скринька фідбеку для адмінки. */
  async listFeedback(opts: { page?: number; limit?: number }) {
    const { page, limit, offset } = normalizePagination(opts);
    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndMapOne('m.sender', Profile, 'p', 'p."userId" = m."senderId"')
      .where('m.kind = :kind', { kind: MessageKind.Feedback })
      .orderBy('m.createdAt', 'DESC')
      .skip(offset)
      .take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  /** Відповідь адмінки на фідбек — потрапляє у вхідні автора. */
  async replyToFeedback(adminId: string, feedbackId: string, dto: SendMessageDto) {
    const feedback = await this.getFeedback(feedbackId);
    return this.save({
      senderId: adminId,
      recipientId: feedback.senderId,
      venueId: null,
      kind: MessageKind.FeedbackReply,
      body: dto.body,
    });
  }

  /** Системне повідомлення від «Пиячок» конкретному користувачу. */
  async sendSystem(userId: string, dto: SendMessageDto) {
    return this.save({
      senderId: null,
      recipientId: userId,
      venueId: null,
      kind: MessageKind.System,
      body: dto.body,
    });
  }

  /** Вхідні користувача: відповіді менеджерів/адмінки та системні. */
  async listInbox(userId: string, opts: { page?: number; limit?: number }) {
    const { page, limit, offset } = normalizePagination(opts);
    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndMapOne('m.sender', Profile, 'p', 'p."userId" = m."senderId"')
      .leftJoinAndMapOne('m.venue', Venue, 'v', 'v.id = m."venueId"')
      .where('m."recipientId" = :userId', { userId })
      .andWhere('m.kind IN (:...kinds)', { kinds: [...INBOX_KINDS] })
      .orderBy('m.createdAt', 'DESC')
      .skip(offset)
      .take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.messages.count({
      where: {
        recipientId: userId,
        isRead: false,
        kind: In([...INBOX_KINDS]),
      },
    });
  }

  async markRead(userId: string, messageId: string) {
    const m = await this.messages.findOne({ where: { id: messageId } });
    if (!m) throw new NotFoundException('Повідомлення не знайдено');
    if (m.recipientId !== userId)
      throw new ForbiddenException('Це не ваше повідомлення');
    if (!m.isRead) {
      m.isRead = true;
      m.readAt = new Date();
      await this.messages.save(m);
    }
    return m;
  }

  private async getOwnVenueMessage(
    managerId: string,
    venueId: string,
    messageId: string,
  ) {
    const message = await this.messages.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Повідомлення не знайдено');
    if (message.venueId !== venueId || message.kind !== MessageKind.UserToManager)
      throw new NotFoundException('Повідомлення не знайдено');
    const venue = await this.venues.findOneOrThrow(venueId);
    await this.assertCanManageVenue(managerId, venue);
    return message;
  }

  private async getFeedback(id: string) {
    const m = await this.messages.findOne({
      where: { id, kind: MessageKind.Feedback },
    });
    if (!m) throw new NotFoundException('Повідомлення не знайдено');
    return m;
  }

  private async assertCanManageVenue(userId: string, venue: Venue) {
    if (venue.ownerId === userId) return;
    if (await this.perms.hasPermission(userId, 'venue:edit:any')) return;
    throw new ForbiddenException('Немає доступу до повідомлень цього закладу');
  }

  private save(data: Partial<Message>) {
    return this.messages.save(this.messages.create(data));
  }
}