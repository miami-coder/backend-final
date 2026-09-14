import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import {
  Hangout,
  HangoutGender,
  HangoutPayer,
  HangoutStatus,
} from './entities/hangout.entity';
import { HangoutParticipant } from './entities/hangout-participant.entity';
import { CreateHangoutDto } from './dto/create-hangout.dto';
import { VenuesService } from '../venues/venues.service';
import { CacheService } from '../../common/services/cache.service';
import {
  buildMeta,
  normalizePagination,
} from '../../common/utils/pagination.util';

export const HANGOUT_FILLED = 'hangout.filled';
export const HANGOUT_CANCELLED = 'hangout.cancelled';

@Injectable()
export class HangoutsService {
  constructor(
    @InjectRepository(Hangout)
    private readonly hangouts: Repository<Hangout>,
    @InjectRepository(HangoutParticipant)
    private readonly participants: Repository<HangoutParticipant>,
    private readonly venues: VenuesService,
    private readonly cache: CacheService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    userId: string,
    venueId: string,
    dto: CreateHangoutDto,
  ): Promise<Hangout> {
    await this.venues.findOneOrThrow(venueId);
    if (new Date(dto.date) < this.startOfToday()) {
      throw new BadRequestException('Дата має бути сьогодні або в майбутньому');
    }
    const h = this.hangouts.create({
      creatorId: userId,
      venueId,
      date: dto.date,
      time: dto.time,
      purpose: dto.purpose,
      gender: dto.gender ?? HangoutGender.Any,
      groupSize: dto.groupSize,
      payer: dto.payer ?? HangoutPayer.Split,
      desiredBudget: dto.desiredBudget ?? null,
      status: HangoutStatus.Open,
    });
    await this.hangouts.save(h);
    await this.participants.save({ hangoutId: h.id, userId });
    return h;
  }

  async join(userId: string, hangoutId: string): Promise<Hangout> {
    const h = await this.findOneOrThrow(hangoutId);
    if (h.status !== HangoutStatus.Open) {
      throw new ConflictException('Заявка вже заповнена або скасована');
    }
    const existing = await this.participants.findOne({
      where: { hangoutId, userId },
    });
    if (existing) throw new ConflictException('Ви вже приєднані');
    const count = await this.participants.count({ where: { hangoutId } });
    if (count >= h.groupSize) {
      throw new ConflictException('Заявка вже заповнена');
    }
    await this.participants.save({ hangoutId, userId });
    const newCount = count + 1;
    if (newCount >= h.groupSize) {
      h.status = HangoutStatus.Filled;
      await this.hangouts.save(h);
      this.events.emit(HANGOUT_FILLED, { hangoutId });
    }
    await this.invalidateListCache();
    return h;
  }

  async leave(userId: string, hangoutId: string): Promise<void> {
    const h = await this.findOneOrThrow(hangoutId);
    if (h.creatorId === userId) {
      const others = await this.participants.count({ where: { hangoutId } });
      if (others > 1) {
        throw new ForbiddenException(
          'Творець не може залишити, поки є інші учасники. Скасуйте заявку.',
        );
      }
    }
    await this.participants.delete({ hangoutId, userId });
    if (h.status === HangoutStatus.Filled) {
      h.status = HangoutStatus.Open;
      await this.hangouts.save(h);
    }
    await this.invalidateListCache();
  }

  async cancel(userId: string, hangoutId: string): Promise<Hangout> {
    const h = await this.findOneOrThrow(hangoutId);
    if (h.creatorId !== userId) {
      throw new ForbiddenException('Тільки творець може скасувати');
    }
    h.status = HangoutStatus.Cancelled;
    await this.hangouts.save(h);
    this.events.emit(HANGOUT_CANCELLED, { hangoutId });
    await this.invalidateListCache();
    return h;
  }

  async listPublic(opts: {
    venueId?: string;
    date?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, offset } = normalizePagination(opts);
    const cacheKey = `hangouts:list:${createHash('sha1').update(JSON.stringify(opts)).digest('hex')}`;
    const cached = await this.cache.get<Hangout[]>(cacheKey);
    if (cached) {
      return {
        data: cached,
        meta: buildMeta({ page, limit, offset }, cached.length),
      };
    }
    const qb = this.hangouts
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.venue', 'v')
      .leftJoinAndSelect('v.photos', 'p')
      .leftJoin('h.participants', 'part')
      .addSelect('COUNT(part."userId")', 'participantsCount')
      .groupBy('h.id, v.id, p.id');
    if (opts.venueId)
      qb.andWhere('h.venueId = :venueId', { venueId: opts.venueId });
    if (opts.date) qb.andWhere('h.date = :date', { date: opts.date });
    if (opts.status) qb.andWhere('h.status = :status', { status: opts.status });
    else qb.andWhere('h.status = :status', { status: HangoutStatus.Open });
    qb.orderBy('h.date', 'ASC')
      .addOrderBy('h.time', 'ASC')
      .skip(offset)
      .take(limit);
    const [data, total] = await qb.getManyAndCount();
    await this.cache.set(cacheKey, data, 30);
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  async getForUser(userId: string, hangoutId: string): Promise<Hangout> {
    const h = await this.hangouts.findOne({
      where: { id: hangoutId },
      relations: { participants: true, venue: true },
    });
    if (!h) throw new NotFoundException('Заявку не знайдено');
    const isParticipant = h.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException('Ви не учасник цієї заявки');
    }
    return h;
  }

  async listMine(userId: string, role: 'created' | 'joined' | 'all') {
    if (role === 'created') {
      return this.hangouts.find({
        where: { creatorId: userId },
        order: { createdAt: 'DESC' },
      });
    }
    if (role === 'joined') {
      return this.hangouts
        .createQueryBuilder('h')
        .innerJoin('h.participants', 'p')
        .where('p.userId = :userId', { userId })
        .andWhere('h.creatorId != :userId', { userId })
        .getMany();
    }
    return this.hangouts
      .createQueryBuilder('h')
      .leftJoin('h.participants', 'p')
      .where(
        new Brackets((b) =>
          b
            .where('h.creatorId = :userId', { userId })
            .orWhere('p.userId = :userId', { userId }),
        ),
      )
      .getMany();
  }

  async findOneOrThrow(id: string): Promise<Hangout> {
    const h = await this.hangouts.findOne({ where: { id } });
    if (!h) throw new NotFoundException('Заявку не знайдено');
    return h;
  }

  async markCompletedBatch(): Promise<number> {
    const result = await this.hangouts
      .createQueryBuilder()
      .update()
      .set({ status: HangoutStatus.Completed })
      .where(
        `status IN ('open','filled') AND (date + time::time)::timestamp < NOW()`,
      )
      .execute();
    await this.invalidateListCache();
    return result.affected ?? 0;
  }

  async invalidateListCache() {
    await this.cache.delByPattern('hangouts:list:*');
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
