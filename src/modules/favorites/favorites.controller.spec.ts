import { Test } from '@nestjs/testing';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('FavoritesController', () => {
  let controller: FavoritesController;
  let favorites: any;

  beforeEach(async () => {
    favorites = {
      add: jest.fn(),
      remove: jest.fn(),
      list: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    };
    const module = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [{ provide: FavoritesService, useValue: favorites }],
    }).compile();
    controller = module.get(FavoritesController);
  });

  it('add delegates to service and returns venueId', async () => {
    const res = await controller.add({ sub: 'u1' } as any, 'v1');
    expect(favorites.add).toHaveBeenCalledWith('u1', 'v1');
    expect(res.data.venueId).toBe('v1');
  });

  it('remove delegates to service and returns venueId', async () => {
    const res = await controller.remove({ sub: 'u1' } as any, 'v1');
    expect(favorites.remove).toHaveBeenCalledWith('u1', 'v1');
    expect(res.data.venueId).toBe('v1');
  });

  it('list delegates to service with user, page, limit', async () => {
    await controller.list({ sub: 'u1' } as any, 2, 10);
    expect(favorites.list).toHaveBeenCalledWith('u1', 2, 10);
  });
});
