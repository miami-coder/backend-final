import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VenuesService } from './venues.service';
import { Venue, VenueStatus } from './entities/venue.entity';
import { VenuePhoto } from './entities/venue-photo.entity';
import { VenueFeature } from './entities/venue-feature.entity';
import { VenueFeatureAssignment } from './entities/venue-feature-assignment.entity';
import { Tag } from './entities/tag.entity';
import { VenueTag } from './entities/venue-tag.entity';
import { VenueType } from './entities/venue-type.entity';
import { VenueTypeAssignment } from './entities/venue-type-assignment.entity';
import { PermissionsService } from '../rbac/permissions.service';
import { CacheService } from '../../common/services/cache.service';
import { FileStorageService } from '../../common/services/file-storage.service';
import { Role } from '../rbac/entities/role.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { AuditService } from '../admin/audit.service';

function qb() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn(),
  };
}

describe('VenuesService', () => {
  let service: VenuesService;
  let venues: any;
  let photos: any;
  let perms: any;
  let cache: any;
  let events: any;
  let storage: any;
  let roles: any;
  let userRoles: any;
  let audit: any;

  beforeEach(async () => {
    venues = {
      create: jest.fn((x) => x),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb()),
    };
    photos = { save: jest.fn(), insert: jest.fn(), count: jest.fn() };
    perms = { hasPermission: jest.fn(), invalidate: jest.fn() };
    roles = { findOne: jest.fn() };
    userRoles = { findOne: jest.fn(), save: jest.fn() };
    audit = { log: jest.fn() };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      delByPattern: jest.fn(),
    };
    events = { emit: jest.fn() };
    storage = { save: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: getRepositoryToken(Venue), useValue: venues },
        {
          provide: getRepositoryToken(VenuePhoto),
          useValue: photos,
        },
        {
          provide: getRepositoryToken(VenueFeature),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(VenueFeatureAssignment),
          useValue: { save: jest.fn() },
        },
        { provide: getRepositoryToken(Tag), useValue: { find: jest.fn() } },
        {
          provide: getRepositoryToken(VenueTag),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(VenueType),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(VenueTypeAssignment),
          useValue: { save: jest.fn() },
        },
        { provide: PermissionsService, useValue: perms },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: events },
        { provide: FileStorageService, useValue: storage },
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: getRepositoryToken(UserRole), useValue: userRoles },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(VenuesService);
  });

  it('create sets status=pending and emits event', async () => {
    const v = await service.create('u1', { name: 'X', address: 'Y' });
    expect((v as any).status).toBe(VenueStatus.Pending);
    expect(events.emit).toHaveBeenCalledWith(
      'venue.created',
      expect.anything(),
    );
  });

  it('update allows owner', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Approved,
    });
    await service.update('u1', 'v1', { name: 'New' });
    expect(events.emit).toHaveBeenCalledWith(
      'venue.updated',
      expect.anything(),
    );
  });

  it('update throws for non-owner without permission', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u2',
      status: VenueStatus.Approved,
    });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(
      service.update('u1', 'v1', { name: 'X' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('update allows super_admin (venue:edit:any)', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u2',
      status: VenueStatus.Approved,
    });
    perms.hasPermission.mockResolvedValueOnce(true);
    await service.update('admin', 'v1', { name: 'X' });
    expect(venues.save).toHaveBeenCalled();
  });

  it('softDelete архівує заклад власника', async () => {
    const venue = {
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Approved,
    };
    venues.findOne.mockResolvedValueOnce(venue);
    await service.softDelete('u1', 'v1');
    expect(venue.status).toBe(VenueStatus.Archived);
    expect(venues.save).toHaveBeenCalledWith(venue);
    expect(events.emit).toHaveBeenCalledWith(
      'venue.status_changed',
      expect.anything(),
    );
  });

  it('softDelete дозволений супер-адміну (venue:edit:any)', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u2',
      status: VenueStatus.Approved,
    });
    perms.hasPermission.mockResolvedValueOnce(true);
    await service.softDelete('admin', 'v1');
    expect(venues.save).toHaveBeenCalled();
  });

  it('approve змінює статус і видає власнику роль venue_admin', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Pending,
    });
    // approve: другий фетч у changeStatus (перевірка archived → потім зміна)
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Pending,
    });
    roles.findOne.mockResolvedValueOnce({ id: 'r1', code: 'venue_admin' });
    userRoles.findOne.mockResolvedValueOnce(null); // ролі ще нема
    const v = await service.approve('admin1', 'v1');
    expect(v.status).toBe(VenueStatus.Approved);
    expect(userRoles.save).toHaveBeenCalledWith({
      userId: 'u1',
      roleId: 'r1',
    });
    // кеш пермішенів власника скидається — роль набирає сили одразу
    expect(perms.invalidate).toHaveBeenCalledWith('u1');
    expect(audit.log).toHaveBeenCalledWith(
      'admin1',
      'venue_approve',
      'venue',
      'v1',
      null,
      expect.anything(),
    );
  });

  it('approve не дублює роль, якщо власник уже має venue_admin', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Pending,
    });
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Pending,
    });
    roles.findOne.mockResolvedValueOnce({ id: 'r1', code: 'venue_admin' });
    userRoles.findOne.mockResolvedValueOnce({ userId: 'u1', roleId: 'r1' });
    await service.approve('admin1', 'v1');
    expect(userRoles.save).not.toHaveBeenCalled();
  });

  it('approve за відсутності ролі venue_admin у системі — статус змінює, роль не видає', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Pending,
    });
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: VenueStatus.Pending,
    });
    roles.findOne.mockResolvedValueOnce(null);
    const v = await service.approve('admin1', 'v1');
    expect(v.status).toBe(VenueStatus.Approved);
    expect(userRoles.save).not.toHaveBeenCalled();
    expect(perms.invalidate).not.toHaveBeenCalled();
  });

  it('softDelete кидає 403 для не-власника без права', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u2',
      status: VenueStatus.Approved,
    });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(service.softDelete('u1', 'v1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('findOneOrThrow throws on missing', async () => {
    venues.findOne.mockResolvedValueOnce(null);
    await expect(service.findOneOrThrow('x')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('search returns from cache when present', async () => {
    cache.get.mockResolvedValueOnce({
      data: [{ id: 'v1', name: 'X' }],
      total: 1,
    });
    const res = await service.search({ page: 1, limit: 20 });
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });

  it('search queries DB on cache miss', async () => {
    const res = await service.search({ page: 1, limit: 20 });
    expect(venues.createQueryBuilder).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalled();
    expect(res.data).toEqual([]);
  });

  it('search: recommended=1 — only рекомендовані критиком (/,top), фільтр іде в where', async () => {
    const mockQb = venues.createQueryBuilder();
    await service.search({ page: 1, limit: 12, recommended: '1' });
    const sqls = mockQb.andWhere.mock.calls.map((c) => c[0] as string);
    expect(sqls).toContain('v.recommendedBy IS NOT NULL');
  });

  it('search без recommended — клаузи рекомендацій у where НЕ додаються (каталог не лізе у вибір критика)', async () => {
    const mockQb = venues.createQueryBuilder();
    await service.search({ page: 1, limit: 12 });
    const sqls = mockQb.andWhere.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => s.includes('recommendedBy'))).toBe(false);
  });

  it('search: фічі/теги — AND-семантика (заклад має ВСІ запитані), CSV не втрачає значення', async () => {
    const mockQb = venues.createQueryBuilder(); // той самий обʼєкт, що піде у search
    await service.search({
      page: 1,
      limit: 20,
      tag: ' cocktails, dj ',
      feature: 'wifi, parking',
    });
    const sqls = mockQb.andWhere.mock.calls.map((c) => c[0] as string);
    // Для КОЖНОГО запитаного коду свій EXISTS-підзапит (AND), а не один IN (OR)
    for (const code of ['wifi', 'parking']) {
      expect(
        sqls.some((s) => s.includes('EXISTS') && s.includes('f2.code = :')),
      ).toBe(true);
    }
    const andParams = mockQb.andWhere.mock.calls
      .flat()
      .filter((x) => typeof x === 'object' && x !== null) as Record<
      string,
      string
    >[];
    const flat = andParams.map((o) => Object.entries(o)).flat();
    for (const code of ['wifi', 'parking']) {
      expect(flat.some(([k, v]) => k.includes('feature') && v === code)).toBe(
        true,
      );
    }
    for (const slug of ['cocktails', 'dj']) {
      expect(flat.some(([k, v]) => k.includes('tag') && v === slug)).toBe(true);
    }
  });

  it('changeStatus emits status_changed event', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      status: VenueStatus.Pending,
    });
    await service.changeStatus('v1', VenueStatus.Approved);
    expect(events.emit).toHaveBeenCalledWith(
      'venue.status_changed',
      expect.anything(),
    );
  });

  describe('uploadPhoto', () => {
    const file = {
      originalname: 'a.png',
      mimetype: 'image/png',
      size: 10,
      buffer: Buffer.from('x'),
    };

    it('зберігає файл, створює VenuePhoto і ставить mainPhotoUrl, якщо його не було', async () => {
      venues.findOne.mockResolvedValueOnce({
        id: 'v1',
        ownerId: 'u1',
        mainPhotoUrl: null,
      });
      photos.count.mockResolvedValueOnce(2);
      storage.save.mockResolvedValueOnce({
        url: '/static/venues/v1/abc.png',
        filename: 'abc.png',
        size: 10,
      });
      const out = await service.uploadPhoto('u1', 'v1', file);
      expect(storage.save).toHaveBeenCalledWith('venues/v1', file);
      expect(photos.insert).toHaveBeenCalledWith({
        venueId: 'v1',
        url: '/static/venues/v1/abc.png',
        sortOrder: 2,
      });
      expect(venues.save).toHaveBeenCalledWith(
        expect.objectContaining({
          mainPhotoUrl: '/static/venues/v1/abc.png',
        }),
      );
      expect(out.url).toBe('/static/venues/v1/abc.png');
    });

    it('не перезаписує наявний mainPhotoUrl', async () => {
      venues.findOne.mockResolvedValueOnce({
        id: 'v1',
        ownerId: 'u1',
        mainPhotoUrl: '/static/venues/v1/old.png',
      });
      storage.save.mockResolvedValueOnce({
        url: '/static/venues/v1/new.png',
        filename: 'new.png',
        size: 10,
      });
      await service.uploadPhoto('u1', 'v1', file);
      expect(venues.save).not.toHaveBeenCalled();
      expect(photos.insert).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/static/venues/v1/new.png' }),
      );
    });

    it('кидає Forbidden для чужого закладу без права venue:edit:any', async () => {
      venues.findOne.mockResolvedValueOnce({
        id: 'v1',
        ownerId: 'u2',
        mainPhotoUrl: null,
      });
      perms.hasPermission.mockResolvedValueOnce(false);
      await expect(service.uploadPhoto('u1', 'v1', file)).rejects.toThrow(
        ForbiddenException,
      );
      expect(storage.save).not.toHaveBeenCalled();
    });
  });

  describe('recommendations (критик)', () => {
    const approved = {
      id: 'v1',
      status: VenueStatus.Approved,
      recommendedBy: null,
      recommendedAt: null,
    };

    beforeEach(() => {
      venues.save.mockImplementation(async (v: any) => v);
      cache.delByPattern.mockResolvedValue(undefined);
    });

    it('recommend ставить recommendedBy/recommendedAt і скидає кеш списку', async () => {
      venues.findOne.mockResolvedValueOnce({ ...approved });
      perms.hasPermission.mockResolvedValueOnce(true);
      const saved = await service.recommend('u-critic', 'v1');
      expect(saved.recommendedBy).toBe('u-critic');
      expect(saved.recommendedAt).toBeInstanceOf(Date);
      expect(cache.delByPattern).toHaveBeenCalled();
    });

    it('recommend кидає 403 без дозволу venue:recommend', async () => {
      venues.findOne.mockResolvedValueOnce({ ...approved });
      perms.hasPermission.mockResolvedValueOnce(false);
      await expect(service.recommend('u1', 'v1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(venues.save).not.toHaveBeenCalled();
    });

    it('recommend кидає 403 для не-схваленого закладу', async () => {
      venues.findOne.mockResolvedValueOnce({
        ...approved,
        status: VenueStatus.Pending,
      });
      perms.hasPermission.mockResolvedValueOnce(true);
      await expect(service.recommend('u-critic', 'v1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(venues.save).not.toHaveBeenCalled();
    });

    it('recommend перезаписує попередню (чужу) рекомендацію — 1 критик на заклад', async () => {
      venues.findOne.mockResolvedValueOnce({
        ...approved,
        recommendedBy: 'u-old-critic',
        recommendedAt: new Date('2026-01-01'),
      });
      perms.hasPermission.mockResolvedValueOnce(true);
      const saved = await service.recommend('u-critic', 'v1');
      expect(saved.recommendedBy).toBe('u-critic');
    });

    it('unrecommend знімає свою рекомендацію', async () => {
      venues.findOne.mockResolvedValueOnce({
        ...approved,
        recommendedBy: 'u-critic',
        recommendedAt: new Date('2026-01-01'),
      });
      perms.hasPermission.mockResolvedValueOnce(true);
      const saved = await service.unrecommend('u-critic', 'v1');
      expect(saved.recommendedBy).toBeNull();
      expect(saved.recommendedAt).toBeNull();
      expect(cache.delByPattern).toHaveBeenCalled();
    });

    it('unrecommend кидає 403 за чужу рекомендацію', async () => {
      venues.findOne.mockResolvedValueOnce({
        ...approved,
        recommendedBy: 'u-another-critic',
      });
      perms.hasPermission.mockResolvedValueOnce(true);
      await expect(service.unrecommend('u-critic', 'v1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(venues.save).not.toHaveBeenCalled();
    });

    it('unrecommend кидає 403 без дозволу venue:recommend', async () => {
      venues.findOne.mockResolvedValueOnce({ ...approved });
      perms.hasPermission.mockResolvedValueOnce(false);
      await expect(service.unrecommend('u1', 'v1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('listRecommendedByUser повертає заклади своєї рекомендації', async () => {
      const listQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]),
      };
      venues.createQueryBuilder.mockReturnValueOnce(listQb);
      const rows = await service.listRecommendedByUser('u-critic');
      expect(rows.map((r: any) => r.id)).toEqual(['v1', 'v2']);
      expect(listQb.where).toHaveBeenCalledWith('v.recommendedBy = :userId', {
        userId: 'u-critic',
      });
    });
  });
});

describe('VenuesService.findOnePublic — санітизація власника', () => {
  let service: VenuesService;
  let venues: any;
  let perms: any;
  let cache: any;
  let events: any;
  let storage: any;
  let photos: any;
  let roles: any;
  let userRoles: any;
  let audit: any;

  beforeEach(async () => {
    photos = {};
    perms = { hasPermission: jest.fn().mockResolvedValue(true) };
    cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
    events = { emit: jest.fn() };
    storage = { save: jest.fn(), remove: jest.fn() };
    roles = {};
    userRoles = {};
    audit = {};
    venues = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn().mockReturnValue(qb()),
    };
    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: getRepositoryToken(Venue), useValue: venues },
        { provide: getRepositoryToken(VenuePhoto), useValue: photos },
        { provide: getRepositoryToken(VenueFeature), useValue: {} },
        { provide: getRepositoryToken(VenueFeatureAssignment), useValue: {} },
        { provide: getRepositoryToken(Tag), useValue: {} },
        { provide: getRepositoryToken(VenueTag), useValue: {} },
        { provide: getRepositoryToken(VenueType), useValue: {} },
        { provide: getRepositoryToken(VenueTypeAssignment), useValue: {} },
        { provide: PermissionsService, useValue: perms },
        { provide: CacheService, useValue: cache },
        { provide: FileStorageService, useValue: storage },
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: getRepositoryToken(UserRole), useValue: userRoles },
        { provide: AuditService, useValue: audit },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(VenuesService);
  });

  it('owner без email/passwordHash/emailVerified/deletedAt і БЕЗ телефона', async () => {
    const venue = {
      id: 'v1',
      status: 'approved',
      owner: {
        id: 'u1',
        email: 'owner@example.com',
        passwordHash: '$2b$10$secretsecretsecret',
        emailVerified: true,
        deletedAt: null,
        profile: {
          firstname: 'Олена',
          lastname: 'Ковальчук',
          avatarUrl: null,
          age: 30,
          phone: '+380991234567',
        },
      },
    };
    venues.createQueryBuilder.mockReturnValueOnce({
      ...qb(),
      getOne: jest.fn().mockResolvedValue(venue),
    });
    const res = await service.findOnePublic('v1');
    expect(res.id).toBe('v1');
    expect(res.owner).not.toHaveProperty('email');
    expect(res.owner).not.toHaveProperty('passwordHash');
    expect(res.owner).not.toHaveProperty('emailVerified');
    expect(res.owner).not.toHaveProperty('deletedAt');
    expect(res.owner.profile.firstname).toBe('Олена');
    expect(res.owner.profile.phone).toBeUndefined();
  });

  it('findApproved (адмінський список модерації) — owner без passwordHash/email/phone', async () => {
    venues.findAndCount.mockResolvedValueOnce([
      [
        {
          id: 'v1',
          owner: {
            id: 'u1',
            email: 'o@x.com',
            passwordHash: '$2b$10$secret',
            profile: { firstname: 'Олег', phone: '+380991234567' },
          },
        },
      ],
      1,
    ]);
    const res = await service.findApproved(1, 20);
    const own = res.data[0].owner as unknown as Record<string, unknown>;
    expect(own).not.toHaveProperty('passwordHash');
    expect(own).not.toHaveProperty('email');
    expect((own.profile as Record<string, unknown>).phone).toBeUndefined();
    expect((own.profile as Record<string, unknown>).firstname).toBe('Олег');
  });
});

describe('VenuesService.search — кеш-хіт повторної сторінки (ревʼю крок 2)', () => {
  let service: VenuesService;
  let venues: any;
  let cache: any;
  let perms: any;
  let cacheSvc: any;
  let events: any;
  let storage: any;
  let audit: any;
  let roles: any;
  let userRoles: any;

  beforeEach(async () => {
    perms = { hasPermission: jest.fn().mockResolvedValue(false) };
    cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
    events = { emit: jest.fn() };
    storage = { save: jest.fn(), remove: jest.fn() };
    audit = {};
    roles = {};
    userRoles = {};
    venues = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn().mockReturnValue(qb()),
    };
    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: getRepositoryToken(Venue), useValue: venues },
        { provide: getRepositoryToken(VenuePhoto), useValue: {} },
        { provide: getRepositoryToken(VenueFeature), useValue: {} },
        { provide: getRepositoryToken(VenueFeatureAssignment), useValue: {} },
        { provide: getRepositoryToken(Tag), useValue: {} },
        { provide: getRepositoryToken(VenueTag), useValue: {} },
        { provide: getRepositoryToken(VenueType), useValue: {} },
        { provide: getRepositoryToken(VenueTypeAssignment), useValue: {} },
        { provide: PermissionsService, useValue: perms },
        { provide: CacheService, useValue: cache },
        { provide: FileStorageService, useValue: storage },
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: getRepositoryToken(UserRole), useValue: userRoles },
        { provide: AuditService, useValue: audit },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(VenuesService);
  });

  it('повторний запит сторінки 2 при 16 закладах НЕ порожній (без пере-зріжування)', async () => {
    // перший запит сторінки 2: БД повертає єдиний 16-й рядок
    const pageTwoQb = {
      ...qb(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'v16' }], 16]),
    };
    venues.createQueryBuilder.mockReturnValueOnce(pageTwoQb);
    const first = await service.search({ page: 2, limit: 15 });
    expect(first.data).toHaveLength(1);
    expect(first.meta.total).toBe(16);
    // кеш збережений
    expect(cache.set).toHaveBeenCalled();
    // повторний запит: кеш-хіт із тим самим сторінковим data
    cache.get.mockResolvedValueOnce({ data: [{ id: 'v16' }], total: 16 });
    const second = await service.search({ page: 2, limit: 15 });
    expect(second.data).toHaveLength(1);
    expect(second.meta.total).toBe(16);
    expect(second.data[0].id).toBe('v16');
  });
});

describe('VenuesService — модерація закладів (ревʼю крок 2)', () => {
  let service: VenuesService;
  let venues: any;
  let cache: any;
  let perms: any;
  let events: any;
  let storage: any;
  let audit: any;
  let roles: any;
  let userRoles: any;

  beforeEach(async () => {
    perms = { hasPermission: jest.fn().mockResolvedValue(false) };
    cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
    events = { emit: jest.fn() };
    storage = { save: jest.fn(), remove: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    roles = {};
    userRoles = { findOne: jest.fn().mockResolvedValue({ id: 'ur1' }) };
    venues = {
      findOne: jest.fn(),
      save: jest.fn((v) => v),
      create: jest.fn((x) => x),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn().mockReturnValue(qb()),
    };
    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: getRepositoryToken(Venue), useValue: venues },
        { provide: getRepositoryToken(VenuePhoto), useValue: {} },
        { provide: getRepositoryToken(VenueFeature), useValue: {} },
        { provide: getRepositoryToken(VenueFeatureAssignment), useValue: {} },
        { provide: getRepositoryToken(Tag), useValue: {} },
        { provide: getRepositoryToken(VenueTag), useValue: {} },
        { provide: getRepositoryToken(VenueType), useValue: {} },
        { provide: getRepositoryToken(VenueTypeAssignment), useValue: {} },
        { provide: PermissionsService, useValue: perms },
        { provide: CacheService, useValue: cache },
        { provide: FileStorageService, useValue: storage },
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: getRepositoryToken(UserRole), useValue: userRoles },
        { provide: AuditService, useValue: audit },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(VenuesService);
  });

  it('апрув видаленого (archived) закладу заборонений', async () => {
    venues.findOne.mockResolvedValueOnce({
      id: 'v1',
      status: 'archived',
      ownerId: 'u9',
    });
    // changeStatus/save не мають апрувнути archived
    await expect(service.approve('admin1', 'v1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(venues.save).not.toHaveBeenCalled();
  });

  it('супер-адмін (venue:moderate) створює заклад одразу approved', async () => {
    perms.hasPermission.mockResolvedValueOnce(true);
    const v = await service.create('admin1', { name: 'Кеш', address: 'а' });
    expect(v.status).toBe('approved');
  });

  it('звичайний юзер створює заклад у pending', async () => {
    perms.hasPermission.mockResolvedValue(false);
    const v = await service.create('u1', { name: 'Звичайний', address: 'а' });
    expect(v.status).toBe('pending');
  });
});

describe('VenuesService.search — %/_ літерали, не wildcard (ревʼю крок 3)', () => {
  it('q з % та _ залишається літералом у ILIKE', async () => {
    const venues = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn().mockReturnValue(qb()),
    };
    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: getRepositoryToken(Venue), useValue: venues },
        { provide: getRepositoryToken(VenuePhoto), useValue: {} },
        { provide: getRepositoryToken(VenueFeature), useValue: {} },
        { provide: getRepositoryToken(VenueFeatureAssignment), useValue: {} },
        { provide: getRepositoryToken(Tag), useValue: {} },
        { provide: getRepositoryToken(VenueTag), useValue: {} },
        { provide: getRepositoryToken(VenueType), useValue: {} },
        { provide: getRepositoryToken(VenueTypeAssignment), useValue: {} },
        { provide: PermissionsService, useValue: { hasPermission: jest.fn() } },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: FileStorageService, useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(UserRole), useValue: {} },
        { provide: AuditService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    const service = module.get(VenuesService);
    await service.search({ page: 1, limit: 20, q: '10%_off' });
    const calls = venues.createQueryBuilder().andWhere.mock.calls;
    // ILIKE живе в Brackets — розгортаємо фабрику проти фейкового будівника
    const bracketArg = calls
      .map((c) => c[0])
      .find((a: any) => a && typeof a.whereFactory === 'function');
    expect(bracketArg).toBeTruthy();
    const rec: { sql: string[]; params: Record<string, unknown>[] } = {
      sql: [],
      params: [],
    };
    const recorder = {
      where(sql: string, params?: Record<string, unknown>) {
        rec.sql.push(sql);
        if (params) rec.params.push(params);
        return recorder;
      },
      orWhere(sql: string, params?: Record<string, unknown>) {
        rec.sql.push(sql);
        if (params) rec.params.push(params);
        return recorder;
      },
    };
    bracketArg.whereFactory(recorder);
    expect(rec.sql[0]).toContain("ESCAPE '!'");
    expect(rec.params[0].q).toBe('%10!%!_off%');
  });
});

describe('VenuesService — довідники типів і фіч (ревʼю крок 3, для select-фільтрів)', () => {
  it('listTypes → [{id, name, slug}], listFeatures → [{id, name, code, icon}]', async () => {
    const typesMock = {
      find: jest
        .fn()
        .mockResolvedValue([{ id: 't1', name: 'Бар', slug: 'bar' }]),
    };
    const featuresMock = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'f1', name: 'Wi-Fi', code: 'wifi', icon: '📶' },
        ]),
    };
    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: getRepositoryToken(Venue), useValue: {} },
        { provide: getRepositoryToken(VenuePhoto), useValue: {} },
        { provide: getRepositoryToken(VenueFeature), useValue: featuresMock },
        { provide: getRepositoryToken(VenueFeatureAssignment), useValue: {} },
        { provide: getRepositoryToken(Tag), useValue: {} },
        { provide: getRepositoryToken(VenueTag), useValue: {} },
        { provide: getRepositoryToken(VenueType), useValue: typesMock },
        { provide: getRepositoryToken(VenueTypeAssignment), useValue: {} },
        { provide: PermissionsService, useValue: { hasPermission: jest.fn() } },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: FileStorageService, useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(UserRole), useValue: {} },
        { provide: AuditService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    const service = module.get(VenuesService);
    expect(await service.listTypes()).toEqual([
      { id: 't1', name: 'Бар', slug: 'bar' },
    ]);
    expect(await service.listFeatures()).toEqual([
      { id: 'f1', name: 'Wi-Fi', code: 'wifi', icon: '📶' },
    ]);
  });
});
