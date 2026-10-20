import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NewsService } from './news.service';
import { News, NewsCategory, NewsStatus } from './entities/news.entity';
import { VenuesService } from '../venues/venues.service';
import { PermissionsService } from '../rbac/permissions.service';
import { FileStorageService } from '../../common/services/file-storage.service';

describe('NewsService', () => {
  let service: NewsService;
  let news: any;
  let venues: any;
  let perms: any;

  beforeEach(async () => {
    news = {
      create: jest.fn((x) => x),
      save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }),
    };
    venues = { findOneOrThrow: jest.fn() };
    perms = { hasPermission: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: getRepositoryToken(News), useValue: news },
        { provide: VenuesService, useValue: venues },
        { provide: PermissionsService, useValue: perms },
        {
          provide: FileStorageService,
          useValue: { save: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(NewsService);
  });

  it('createForVenue allows owner', async () => {
    venues.findOneOrThrow.mockResolvedValueOnce({ ownerId: 'u1' });
    await service.createForVenue('u1', 'v1', {
      category: NewsCategory.Promo,
      title: 'Акція!',
      content: 'Деталі акції тут',
    });
    expect(news.save).toHaveBeenCalled();
  });

  it('createForVenue forbids non-owner without perm', async () => {
    venues.findOneOrThrow.mockResolvedValueOnce({ ownerId: 'u2' });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(
      service.createForVenue('u1', 'v1', {
        category: NewsCategory.Promo,
        title: 'Акція!',
        content: 'Деталі акції тут',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('createGlobal does not require venue', async () => {
    const r = await service.createGlobal({
      category: NewsCategory.General,
      title: 'Загальна новина',
      content: 'Щось сталось у місті',
    });
    expect(r.venueId).toBeNull();
  });

  it('update дозволяє власнику закладу новини', async () => {
    news.findOne.mockResolvedValueOnce({ id: 'n1', venueId: 'v1' });
    venues.findOneOrThrow.mockResolvedValueOnce({ ownerId: 'u1' });
    await service.update('n1', 'u1', { title: 'Оновлено' });
    expect(news.save).toHaveBeenCalled();
  });

  it('update забороняє чужу новину без news:manage:any', async () => {
    news.findOne.mockResolvedValueOnce({ id: 'n1', venueId: 'v1' });
    venues.findOneOrThrow.mockResolvedValueOnce({ ownerId: 'u2' });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(
      service.update('n1', 'u1', { title: 'Оновлено' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('update глобальної новини вимагає news:manage:any', async () => {
    news.findOne.mockResolvedValueOnce({ id: 'n1', venueId: null });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(
      service.update('n1', 'u1', { title: 'Оновлено' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('softDelete забороняє чужу новину без news:manage:any', async () => {
    news.findOne.mockResolvedValueOnce({ id: 'n1', venueId: 'v1' });
    venues.findOneOrThrow.mockResolvedValueOnce({ ownerId: 'u2' });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(service.softDelete('n1', 'u1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('softDelete дозволяє суперадміну', async () => {
    news.findOne.mockResolvedValueOnce({
      id: 'n1',
      venueId: 'v1',
      status: NewsStatus.Published,
    });
    perms.hasPermission.mockResolvedValueOnce(true);
    const r = await service.softDelete('n1', 'u1');
    expect(r.status).toBe(NewsStatus.Archived);
  });

  it('listAdmin без status не фільтрує статус', async () => {
    const qb = news.createQueryBuilder();
    await service.listAdmin({ page: 1, limit: 20 });
    expect(qb.where).not.toHaveBeenCalled();
  });

  it('listAdmin зі status фільтрує ним', async () => {
    const qb = news.createQueryBuilder();
    await service.listAdmin({ page: 1, limit: 20, status: NewsStatus.Draft });
    expect(qb.where).toHaveBeenCalledWith('n.status = :status', {
      status: NewsStatus.Draft,
    });
  });
});

describe('NewsService — видимість новин і «просунутий» прапор (ревʼю крок 2)', () => {
  let service: NewsService;
  let news: any;
  let venues: any;
  let perms: any;

  beforeEach(async () => {
    news = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve(x)),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }),
    };
    venues = { findOneOrThrow: jest.fn() };
    perms = { hasPermission: jest.fn().mockResolvedValue(false) };
    const module = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: getRepositoryToken(News), useValue: news },
        { provide: VenuesService, useValue: venues },
        { provide: PermissionsService, useValue: perms },
        { provide: FileStorageService, useValue: { save: jest.fn() } },
      ],
    }).compile();
    service = module.get(NewsService);
  });

  it('getPublic archived-новини → 404', async () => {
    news.findOne.mockResolvedValueOnce({ id: 'n1', status: 'archived' });
    await expect(service.getPublic('n1')).rejects.toThrow(NotFoundException);
  });

  it('getPublic новини Published схованого закладу (pending) → 404', async () => {
    news.findOne.mockResolvedValueOnce({
      id: 'n1',
      status: 'published',
      venueId: 'v1',
    });
    venues.findOneOrThrow.mockResolvedValueOnce({
      id: 'v1',
      status: 'pending',
    });
    await expect(service.getPublic('n1')).rejects.toThrow(NotFoundException);
  });

  it('getPublic Published новини approved закладу — ок', async () => {
    news.findOne.mockResolvedValueOnce({
      id: 'n1',
      status: 'published',
      venueId: 'v1',
    });
    venues.findOneOrThrow.mockResolvedValueOnce({
      id: 'v1',
      status: 'approved',
    });
    await expect(service.getPublic('n1')).resolves.toBeDefined();
  });

  it('create від юзера без news:manage:any: isPromoted=true → false', async () => {
    venues.findOneOrThrow.mockResolvedValueOnce({ id: 'v1', ownerId: 'u1' });
    const n = await service.createForVenue('u1', 'v1', {
      title: 't',
      content: 'b',
      category: NewsCategory.VenueNews,
      isPromoted: true,
    } as any);
    expect(n.isPromoted).toBe(false);
  });

  it('create глобальної новини (адмін-роут) — isPromoted зберігається', async () => {
    const n = await service.createGlobal({
      title: 't',
      content: 'b',
      category: NewsCategory.VenueNews,
      isPromoted: true,
    } as any);
    expect(n.isPromoted).toBe(true);
  });

  it('update юзером без права не міняє існуючий isPromoted', async () => {
    news.findOne.mockResolvedValueOnce({
      id: 'n1',
      status: 'published',
      venueId: 'v1',
      isPromoted: true,
    });
    venues.findOneOrThrow.mockResolvedValueOnce({
      id: 'v1',
      ownerId: 'u1',
      status: 'approved',
    });
    await service.update('n1', 'u1', { isPromoted: false } as any);
    expect(news.save).toHaveBeenCalledWith(
      expect.objectContaining({ isPromoted: true }),
    );
  });
});
