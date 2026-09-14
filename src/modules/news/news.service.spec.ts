import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { NewsService } from './news.service';
import { News, NewsCategory, NewsStatus } from './entities/news.entity';
import { VenuesService } from '../venues/venues.service';
import { PermissionsService } from '../rbac/permissions.service';

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
