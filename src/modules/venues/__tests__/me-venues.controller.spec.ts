// backend-final/src/modules/venues/__tests__/me-venues.controller.spec.ts
import { Test } from '@nestjs/testing';
import { MeVenuesController } from '../me-venues.controller';
import { VenuesService } from '../venues.service';

describe('MeVenuesController', () => {
  let controller: MeVenuesController;
  let venues: any;

  beforeEach(async () => {
    venues = { listMineForUser: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [MeVenuesController],
      providers: [{ provide: VenuesService, useValue: venues }],
    }).compile();
    controller = module.get(MeVenuesController);
  });

  it('list delegates to listMineForUser and wraps in { data }', async () => {
    venues.listMineForUser.mockResolvedValue([{ id: 'v1', status: 'pending' }]);
    const res = await controller.list({ sub: 'u1' } as any);
    expect(venues.listMineForUser).toHaveBeenCalledWith('u1');
    expect(res.data[0].id).toBe('v1');
  });
});
