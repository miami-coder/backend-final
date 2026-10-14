import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { Favorite } from './entities/favorite.entity';
import { Venue } from '../venues/entities/venue.entity';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let favorites: any;
  let venues: any;

  beforeEach(async () => {
    favorites = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawAndEntities: jest
          .fn()
          .mockResolvedValue({ entities: [], raw: [] }),
      }),
    };
    venues = { findOne: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(Favorite), useValue: favorites },
        { provide: getRepositoryToken(Venue), useValue: venues },
      ],
    }).compile();
    service = module.get(FavoritesService);
  });

  it('add throws when venue missing', async () => {
    venues.findOne.mockResolvedValueOnce(null);
    await expect(service.add('u1', 'v1')).rejects.toThrow(NotFoundException);
  });

  it('add is idempotent (no error if already exists)', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1' });
    favorites.findOne.mockResolvedValueOnce({ userId: 'u1', venueId: 'v1' });
    await service.add('u1', 'v1');
    expect(favorites.save).not.toHaveBeenCalled();
  });

  it('add saves when new', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1' });
    favorites.findOne.mockResolvedValueOnce(null);
    await service.add('u1', 'v1');
    expect(favorites.save).toHaveBeenCalledWith({
      userId: 'u1',
      venueId: 'v1',
    });
  });
});
