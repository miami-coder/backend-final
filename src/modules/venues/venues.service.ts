import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Venue, VenueStatus } from './entities/venue.entity';
import { VenuePhoto } from './entities/venue-photo.entity';
import { VenueFeature } from './entities/venue-feature.entity';
import { VenueFeatureAssignment } from './entities/venue-feature-assignment.entity';
import { Tag } from './entities/tag.entity';
import { VenueTag } from './entities/venue-tag.entity';
import { VenueType } from './entities/venue-type.entity';
import { VenueTypeAssignment } from './entities/venue-type-assignment.entity';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { QueryVenuesDto, VenueSort } from './dto/query-venues.dto';
import { PermissionsService } from '../rbac/permissions.service';
import { Role } from '../rbac/entities/role.entity';
import { RoleCode } from '../rbac/entities/role.enum';
import { UserRole } from '../rbac/entities/user-role.entity';
import { AuditService } from '../admin/audit.service';
import { CacheService } from '../../common/services/cache.service';
import { FileStorageService } from '../../common/services/file-storage.service';
import {
  buildMeta,
  normalizePagination,
} from '../../common/utils/pagination.util';
import { createHash } from 'crypto';
import {
  VENUE_CREATED,
  VENUE_STATUS_CHANGED,
  VENUE_UPDATED,
  VenueCreatedEvent,
  VenueStatusChangedEvent,
  VenueUpdatedEvent,
} from './events';

@Injectable()
export class VenuesService {
  constructor(
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(VenuePhoto)
    private readonly photos: Repository<VenuePhoto>,
    @InjectRepository(VenueFeature)
    private readonly features: Repository<VenueFeature>,
    @InjectRepository(VenueFeatureAssignment)
    private readonly featureAssignments: Repository<VenueFeatureAssignment>,
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    @InjectRepository(VenueTag)
    private readonly venueTags: Repository<VenueTag>,
    @InjectRepository(VenueType)
    private readonly venueTypes: Repository<VenueType>,
    @InjectRepository(VenueTypeAssignment)
    private readonly venueTypeAssignments: Repository<VenueTypeAssignment>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    private readonly perms: PermissionsService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly events: EventEmitter2,
    private readonly storage: FileStorageService,
  ) {}

  /** Довідник тегів: тег + кількість закладів, де він використаний. */
  async listTags(): Promise<
    { id: string; name: string; slug: string; venueCount: number }[]
  > {
    return this.tags
      .createQueryBuilder('t')
      .select('t.id', 'id')
      .addSelect('t.name', 'name')
      .addSelect('t.slug', 'slug')
      .addSelect('COUNT(vt."venueId")::int', 'venueCount')
      .leftJoin(VenueTag, 'vt', 'vt."tagId" = t."id"')
      .groupBy('t.id')
      .orderBy('venueCount', 'DESC')
      .addOrderBy('t.name', 'ASC')
      .getRawMany<{ id: string; name: string; slug: string; venueCount: number }>();
  }

  async create(ownerId: string, dto: CreateVenueDto): Promise<Venue> {
    const venue = this.venues.create({
      ownerId,
      name: dto.name,
      description: dto.description ?? null,
      address: dto.address,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      contacts: dto.contacts ?? {},
      workingHours: dto.workingHours ?? {},
      averageCheck: dto.averageCheck ?? null,
      status: VenueStatus.Pending,
    });
    await this.venues.save(venue);
    if (dto.featureCodes?.length) {
      const features = await this.features.find({
        where: { code: In(dto.featureCodes) },
      });
      await this.featureAssignments.save(
        features.map((f) => ({ venueId: venue.id, featureId: f.id })),
      );
    }
    if (dto.tagSlugs?.length) {
      const tags = await this.tags.find({ where: { slug: In(dto.tagSlugs) } });
      await this.venueTags.save(
        tags.map((t) => ({ venueId: venue.id, tagId: t.id })),
      );
    }
    if (dto.typeSlug) {
      const type = await this.venueTypes.findOne({
        where: { slug: dto.typeSlug },
      });
      if (type)
        await this.venueTypeAssignments.save({
          venueId: venue.id,
          typeId: type.id,
        });
    }
    this.events.emit(VENUE_CREATED, new VenueCreatedEvent(venue.id));
    return venue;
  }

  async update(
    userId: string,
    venueId: string,
    dto: UpdateVenueDto,
  ): Promise<Venue> {
    const venue = await this.findOneOrThrow(venueId);
    await this.assertCanEdit(userId, venue);
    Object.assign(venue, {
      name: dto.name ?? venue.name,
      description: dto.description ?? venue.description,
      address: dto.address ?? venue.address,
      latitude: dto.latitude ?? venue.latitude,
      longitude: dto.longitude ?? venue.longitude,
      contacts: dto.contacts ?? venue.contacts,
      workingHours: dto.workingHours ?? venue.workingHours,
      averageCheck: dto.averageCheck ?? venue.averageCheck,
    });
    await this.venues.save(venue);
    this.events.emit(VENUE_UPDATED, new VenueUpdatedEvent(venue.id));
    return venue;
  }

  async softDelete(userId: string, venueId: string): Promise<void> {
    const venue = await this.findOneOrThrow(venueId);
    await this.assertCanEdit(userId, venue);
    venue.status = VenueStatus.Archived;
    await this.venues.save(venue);
    this.events.emit(
      VENUE_STATUS_CHANGED,
      new VenueStatusChangedEvent(venue.id, 'approved', 'archived'),
    );
  }

  async findOneOrThrow(id: string): Promise<Venue> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Заклад не знайдено');
    return venue;
  }

  async findOnePublic(id: string): Promise<Venue> {
    const venue = await this.venues
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.owner', 'o')
      .leftJoinAndSelect('o.profile', 'p')
      .where('v.id = :id', { id })
      .andWhere('v.status = :status', { status: VenueStatus.Approved })
      .getOne();
    if (!venue) throw new NotFoundException('Заклад не знайдено');
    return venue;
  }

  async listMineForUser(userId: string): Promise<Venue[]> {
    return this.venues.find({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
      relations: { photos: true },
    });
  }

  async findOneForOwnerQuery(id: string): Promise<Venue | null> {
    // Те саме насичення, що в search(): photos + features + tags + types
    return this.venues
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.photos', 'photo')
      .leftJoin('v.featureAssignments', 'fa')
      .leftJoinAndSelect('fa.feature', 'f')
      .leftJoin('v.venueTags', 'vt')
      .leftJoinAndSelect('vt.tag', 't')
      .leftJoin('v.venueTypeAssignments', 'vta')
      .leftJoinAndSelect('vta.type', 'ty')
      .where('v.id = :id', { id })
      .getOne();
  }

  async search(query: QueryVenuesDto) {
    const { page, limit, offset } = normalizePagination(query);
    const cacheKey = `venues:list:${this.hashQuery(query)}`;
    const cached = await this.cache.get<{ data: any[]; total: number }>(
      cacheKey,
    );
    if (cached) {
      return {
        data: cached.data.slice(offset, offset + limit),
        meta: buildMeta({ page, limit, offset }, cached.total),
      };
    }

    const qb = this.venues
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.photos', 'photo')
      .leftJoin('v.featureAssignments', 'fa')
      .leftJoinAndSelect('fa.feature', 'f')
      .leftJoin('v.venueTags', 'vt')
      .leftJoinAndSelect('vt.tag', 't')
      .leftJoin('v.venueTypeAssignments', 'vta')
      .leftJoinAndSelect('vta.type', 'ty')
      .where('v.status = :status', { status: VenueStatus.Approved });

    if (query.q) {
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('v.name ILIKE :q', { q: `%${query.q}%` })
            .orWhere('v.address ILIKE :q', { q: `%${query.q}%` }),
        ),
      );
    }
    if (query.minRating != null)
      qb.andWhere('v.ratingAvg >= :minRating', { minRating: query.minRating });
    if (query.minCheck != null)
      qb.andWhere('v.averageCheck >= :minCheck', { minCheck: query.minCheck });
    if (query.maxCheck != null)
      qb.andWhere('v.averageCheck <= :maxCheck', { maxCheck: query.maxCheck });
    if (query.feature)
      qb.andWhere('f.code IN (:...features)', {
        features: query.feature.split(','),
      });
    if (query.tag)
      qb.andWhere('t.slug IN (:...tags)', { tags: query.tag.split(',') });
    if (query.type) qb.andWhere('ty.slug = :type', { type: query.type });
    if (query.lat != null && query.lng != null && query.radiusKm != null) {
      qb.andWhere(
        `ST_DWithin(v.location, ST_MakePoint(:lng, :lat)::geography, :meters)`,
        { lng: query.lng, lat: query.lat, meters: query.radiusKm * 1000 },
      );
    }

    const sort: VenueSort = query.sort ?? 'newest';
    switch (sort) {
      case 'rating':
        qb.orderBy('v.ratingAvg', 'DESC', 'NULLS LAST').addOrderBy(
          'v.ratingCount',
          'DESC',
        );
        break;
      case 'check':
        qb.orderBy('v.averageCheck', 'ASC', 'NULLS LAST');
        break;
      case 'name':
        qb.orderBy('v.name', 'ASC');
        break;
      case 'distance':
        if (query.lat != null && query.lng != null) {
          qb.addSelect(
            `ST_Distance(v.location, ST_MakePoint(:lng, :lat)::geography)`,
            'distance',
          ).orderBy('distance', 'ASC');
        } else {
          qb.orderBy('v.createdAt', 'DESC');
        }
        break;
      case 'newest':
      default:
        qb.orderBy('v.createdAt', 'DESC');
    }
    qb.skip(offset).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    await this.cache.set(cacheKey, { data: rows, total }, 60);
    return { data: rows, meta: buildMeta({ page, limit, offset }, total) };
  }

  async findPending(page = 1, limit = 20) {
    const { offset } = normalizePagination({ page, limit });
    const [rows, total] = await this.venues.findAndCount({
      where: { status: VenueStatus.Pending },
      order: { createdAt: 'ASC' },
      skip: offset,
      take: limit,
      // Адмін має бачити заявку цілком: власник, фото, тип/теги/фічі
      relations: {
        owner: { profile: true },
        photos: true,
        featureAssignments: { feature: true },
        venueTags: { tag: true },
        venueTypeAssignments: { type: true },
      },
    });
    return { data: rows, meta: buildMeta({ page, limit, offset }, total) };
  }

  async findApproved(page = 1, limit = 20) {
    const { offset } = normalizePagination({ page, limit });
    const [rows, total] = await this.venues.findAndCount({
      where: { status: VenueStatus.Approved },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
      // Для передачі керування потрібен лише поточний власник
      relations: { owner: { profile: true } },
    });
    return { data: rows, meta: buildMeta({ page, limit, offset }, total) };
  }

  async changeStatus(venueId: string, to: VenueStatus): Promise<Venue> {
    const venue = await this.findOneOrThrow(venueId);
    const from = venue.status;
    venue.status = to;
    await this.venues.save(venue);
    this.events.emit(
      VENUE_STATUS_CHANGED,
      new VenueStatusChangedEvent(venueId, from, to),
    );
    return venue;
  }

  // Апрув: статус → approved + власник отримує роль venue_admin (ідемпотентно).
  // Ручна видача ролей супер-адміном лишається незалежною.
  async approve(actorId: string, venueId: string): Promise<Venue> {
    const venue = await this.changeStatus(venueId, VenueStatus.Approved);
    const roleGranted = venue.ownerId
      ? await this.grantVenueAdmin(venue.ownerId)
      : false;
    await this.audit.log(actorId, 'venue_approve', 'venue', venueId, null, {
      status: 'approved',
      ownerId: venue.ownerId,
      roleGranted,
    });
    return venue;
  }

  // Ідемпотентна видача venue_admin власнику схваленого закладу
  private async grantVenueAdmin(userId: string): Promise<boolean> {
    const role = await this.roles.findOne({
      where: { code: RoleCode.VenueAdmin },
    });
    if (!role) return false;
    const existing = await this.userRoles.findOne({
      where: { userId, roleId: role.id },
    });
    if (existing) return false;
    await this.userRoles.save({ userId, roleId: role.id });
    // кеш пермішенів (TTL 5 хв) треба скинути, щоб роль набрала сили одразу
    await this.perms.invalidate(userId);
    return true;
  }

  async invalidateListCache() {
    await this.cache.delByPattern('venues:list:*');
  }

  private async assertCanEdit(userId: string, venue: Venue) {
    if (venue.ownerId === userId) return;
    if (await this.perms.hasPermission(userId, 'venue:edit:any')) return;
    throw new ForbiddenException('Не можна редагувати цей заклад');
  }

  // Завантаження фото: файл у storage + запис у venue_photos (без цього фото
  // ніде не показувалось би) + mainPhotoUrl для першого фото.
  async uploadPhoto(
    userId: string,
    venueId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ): Promise<{ url: string; filename: string; size: number }> {
    const venue = await this.findOneOrThrow(venueId);
    await this.assertCanEdit(userId, venue);
    const stored = await this.storage.save(`venues/${venueId}`, file);
    const sortOrder = await this.photos.count({ where: { venueId } });
    await this.photos.insert({
      venueId,
      url: stored.url,
      sortOrder,
    });
    if (!venue.mainPhotoUrl) {
      venue.mainPhotoUrl = stored.url;
      await this.venues.save(venue);
    }
    return stored;
  }

  private hashQuery(q: QueryVenuesDto): string {
    return createHash('sha1').update(JSON.stringify(q)).digest('hex');
  }
}
