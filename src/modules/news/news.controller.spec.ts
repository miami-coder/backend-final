import { Test } from '@nestjs/testing';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

describe('NewsController', () => {
  let controller: NewsController;
  let news: any;

  beforeEach(async () => {
    news = {
      listPublic: jest.fn(),
      get: jest.fn(),
      createForVenue: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [NewsController],
      providers: [{ provide: NewsService, useValue: news }],
    }).compile();
    controller = module.get(NewsController);
  });

  it('list delegates and normalizes isPromoted', async () => {
    news.listPublic.mockResolvedValue({ data: [], meta: { total: 0 } });
    await controller.list({
      category: 'promo',
      venueId: 'v1',
      page: 1,
      limit: 20,
      isPromoted: 'true',
    });
    expect(news.listPublic).toHaveBeenCalledWith({
      category: 'promo',
      venueId: 'v1',
      page: 1,
      limit: 20,
      isPromoted: true,
    });
  });

  it('list leaves isPromoted undefined when not "true"', async () => {
    news.listPublic.mockResolvedValue({ data: [], meta: { total: 0 } });
    await controller.list({ isPromoted: 'false' });
    expect(news.listPublic).toHaveBeenCalledWith({ isPromoted: undefined });
  });

  it('get wraps result in { data }', async () => {
    news.get.mockResolvedValue({ id: 'n1' });
    const res = await controller.get('n1');
    expect(news.get).toHaveBeenCalledWith('n1');
    expect(res.data.id).toBe('n1');
  });

  it('createForVenue wraps result in { data }', async () => {
    news.createForVenue.mockResolvedValue({ id: 'n1' });
    const res = await controller.createForVenue({ sub: 'u1' } as any, 'v1', {
      title: 'Хелоу',
    } as any);
    expect(news.createForVenue).toHaveBeenCalledWith('u1', 'v1', {
      title: 'Хелоу',
    });
    expect(res.data.id).toBe('n1');
  });

  it('update wraps result in { data }', async () => {
    news.update.mockResolvedValue({ id: 'n1' });
    const res = await controller.update(
      { sub: 'u1' } as any,
      'n1',
      { title: 'Оновлено' } as any,
    );
    expect(news.update).toHaveBeenCalledWith('n1', 'u1', {
      title: 'Оновлено',
    });
    expect(res.data.id).toBe('n1');
  });

  it('remove delegates to softDelete with user id', async () => {
    news.softDelete.mockResolvedValue(undefined);
    await controller.remove({ sub: 'u1' } as any, 'n1');
    expect(news.softDelete).toHaveBeenCalledWith('n1', 'u1');
  });
});
