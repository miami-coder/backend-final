import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { News, NewsStatus } from './entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { VenuesService } from '../venues/venues.service';
import { PermissionsService } from '../rbac/permissions.service';
import {
  buildMeta,
  normalizePagination,
} from '../../common/utils/pagination.util';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(News) private readonly news: Repository<News>,
    private readonly venues: VenuesService,
    private readonly perms: PermissionsService,
  ) {}

  async createForVenue(userId: string, venueId: string, dto: CreateNewsDto) {
    const venue = await this.venues.findOneOrThrow(venueId);
    if (
      venue.ownerId !== userId &&
      !(await this.perms.hasPermission(userId, 'news:manage:any'))
    ) {
      throw new ForbiddenException('Не можна керувати новинами цього закладу');
    }
    return this.save(dto, venueId);
  }

  async createGlobal(dto: CreateNewsDto) {
    return this.save(dto, null);
  }

  private async save(dto: CreateNewsDto, venueId: string | null) {
    const now = new Date();
    const entity = this.news.create({
      venueId,
      category: dto.category,
      title: dto.title,
      content: dto.content,
      imageUrl: dto.imageUrl ?? null,
      status: dto.status ?? NewsStatus.Published,
      isPromoted: dto.isPromoted ?? false,
      publishedAt: now,
    });
    return this.news.save(entity);
  }

  async listPublic(opts: {
    category?: string;
    venueId?: string;
    page?: number;
    limit?: number;
    isPromoted?: boolean;
  }) {
    const { page, limit, offset } = normalizePagination(opts);
    const qb = this.news
      .createQueryBuilder('n')
      .where('n.status = :status', { status: NewsStatus.Published });
    if (opts.category)
      qb.andWhere('n.category = :category', { category: opts.category });
    if (opts.venueId)
      qb.andWhere('n.venueId = :venueId', { venueId: opts.venueId });
    if (opts.isPromoted) qb.andWhere('n.isPromoted = true');
    qb.orderBy('n.isPromoted', 'DESC')
      .addOrderBy('n.publishedAt', 'DESC')
      .skip(offset)
      .take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  async get(id: string) {
    const n = await this.news.findOne({ where: { id } });
    if (!n) throw new NotFoundException('Новину не знайдено');
    return n;
  }

  async update(id: string, dto: Partial<CreateNewsDto>) {
    const n = await this.get(id);
    Object.assign(n, dto);
    return this.news.save(n);
  }

  async softDelete(id: string) {
    const n = await this.get(id);
    n.status = NewsStatus.Archived;
    return this.news.save(n);
  }
}
