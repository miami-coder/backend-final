import { Test } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { FileStorageService } from '../../common/services/file-storage.service';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let reviews: any;
  let storage: any;

  beforeEach(async () => {
    reviews = {
      create: jest.fn(),
      listForVenue: jest.fn(),
      findOneOrThrow: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      feature: jest.fn(),
      listForUser: jest.fn(),
    };
    storage = { save: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: ReviewsService, useValue: reviews },
        { provide: FileStorageService, useValue: storage },
      ],
    }).compile();
    controller = module.get(ReviewsController);
  });

  it('create delegates', async () => {
    reviews.create.mockResolvedValue({ id: 'r1' });
    const res = await controller.create({ sub: 'u1' } as any, 'v1', {
      rating: 5,
      text: 'Чудово! Все сподобалось',
    });
    expect(res.data.id).toBe('r1');
  });

  it('list delegates', async () => {
    reviews.listForVenue.mockResolvedValue({ data: [], meta: { total: 0 } });
    await controller.list('v1', 1, 20);
    expect(reviews.listForVenue).toHaveBeenCalledWith('v1', 1, 20, undefined);
  });
});
