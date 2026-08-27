import { Test } from '@nestjs/testing';
import { AdminNewsController } from './admin-news.controller';
import { NewsService } from './news.service';

describe('AdminNewsController', () => {
  let controller: AdminNewsController;
  let news: any;

  beforeEach(async () => {
    news = {
      listPublic: jest.fn(),
      createGlobal: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [AdminNewsController],
      providers: [{ provide: NewsService, useValue: news }],
    }).compile();
    controller = module.get(AdminNewsController);
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

  it('createGlobal wraps result in { data }', async () => {
    news.createGlobal.mockResolvedValue({ id: 'n1' });
    const res = await controller.createGlobal({ title: 'Глобальна' } as any);
    expect(news.createGlobal).toHaveBeenCalledWith({ title: 'Глобальна' });
    expect(res.data.id).toBe('n1');
  });
});
