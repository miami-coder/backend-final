import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Venue } from '../venues/entities/venue.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { PermissionsService } from '../rbac/permissions.service';
import { REVIEW_CREATED, REVIEW_DELETED, REVIEW_UPDATED } from './events';
import {
  buildMeta,
  normalizePagination,
} from '../../common/utils/pagination.util';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    private readonly perms: PermissionsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    userId: string,
    venueId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const venue = await this.venues.findOne({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Заклад не знайдено');
    if (venue.ownerId === userId)
      throw new ForbiddenException(
        'Не можна залишати відгук на власний заклад',
      );
    const existing = await this.reviews.findOne({ where: { venueId, userId } });
    if (existing)
      throw new ConflictException('Ви вже залишили відгук на цей заклад');
    const review = this.reviews.create({
      venueId,
      userId,
      ...dto,
      checkPhotoUrl: dto.checkPhotoUrl ?? null,
    });
    const saved = await this.reviews.save(review);
    await this.recalc(venueId);
    this.events.emit(REVIEW_CREATED, { reviewId: saved.id, venueId });
    return saved;
  }

  async update(
    userId: string,
    reviewId: string,
    dto: UpdateReviewDto,
  ): Promise<Review> {
    const review = await this.findOneOrThrow(reviewId);
    if (
      review.userId !== userId &&
      !(await this.perms.hasPermission(userId, 'review:edit:any'))
    ) {
      throw new ForbiddenException('Не можна редагувати цей відгук');
    }
    Object.assign(review, dto);
    await this.reviews.save(review);
    await this.recalc(review.venueId);
    this.events.emit(REVIEW_UPDATED, { reviewId, venueId: review.venueId });
    return review;
  }

  async softDelete(userId: string, reviewId: string): Promise<void> {
    const review = await this.findOneOrThrow(reviewId);
    if (
      review.userId !== userId &&
      !(await this.perms.hasPermission(userId, 'review:edit:any'))
    ) {
      throw new ForbiddenException('Не можна видалити цей відгук');
    }
    const venueId = review.venueId;
    await this.reviews.delete(reviewId);
    await this.recalc(venueId);
    this.events.emit(REVIEW_DELETED, { reviewId, venueId });
  }

  async findOneOrThrow(id: string): Promise<Review> {
    const r = await this.reviews.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Відгук не знайдено');
    return r;
  }

  async listForVenue(
    venueId: string,
    page = 1,
    limit = 20,
    sort: 'newest' | 'oldest' | 'highest' | 'lowest' = 'newest',
  ) {
    const { offset } = normalizePagination({ page, limit });
    const orderMap: Record<
      typeof sort,
      { column: 'createdAt' | 'rating'; dir: 'DESC' | 'ASC' }
    > = {
      newest: { column: 'createdAt', dir: 'DESC' },
      oldest: { column: 'createdAt', dir: 'ASC' },
      highest: { column: 'rating', dir: 'DESC' },
      lowest: { column: 'rating', dir: 'ASC' },
    };
    const order = orderMap[sort];
    const [data, total] = await this.reviews
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .leftJoinAndSelect('u.profile', 'p')
      .where('r.venueId = :venueId', { venueId })
      .orderBy('r.isFeatured', 'DESC')
      .addOrderBy(`r.${order.column}`, order.dir)
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  async listForUser(userId: string) {
    return this.reviews.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Список усіх відгуків для адмінки (суперадмін). */
  async listAdmin(opts: { venueId?: string; page?: number; limit?: number }) {
    const { page, limit, offset } = normalizePagination(opts);
    const qb = this.reviews
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .leftJoinAndSelect('u.profile', 'p')
      .leftJoinAndSelect('r.venue', 'v');
    if (opts.venueId)
      qb.where('r.venueId = :venueId', { venueId: opts.venueId });
    qb.orderBy('r.createdAt', 'DESC').skip(offset).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  async feature(reviewId: string) {
    const r = await this.findOneOrThrow(reviewId);
    r.isFeatured = true;
    return this.reviews.save(r);
  }

  async unfeature(reviewId: string) {
    const r = await this.findOneOrThrow(reviewId);
    r.isFeatured = false;
    return this.reviews.save(r);
  }

  private async recalc(venueId: string) {
    const result = await this.reviews
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.venueId = :venueId', { venueId })
      .getRawOne<{ avg: string; count: string }>();
    await this.venues.update(venueId, {
      ratingAvg: Number(result?.avg ?? 0),
      ratingCount: Number(result?.count ?? 0),
    });
  }
}
