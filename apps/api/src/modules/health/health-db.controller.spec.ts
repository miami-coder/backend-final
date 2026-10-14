import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthDbController } from './health-db.controller';
import { CacheService } from '../../common/services/cache.service';

describe('HealthDbController', () => {
  let controller: HealthDbController;
  let ds: any;
  let cache: any;

  beforeEach(async () => {
    ds = { query: jest.fn().mockResolvedValue(undefined) };
    cache = { isConnected: jest.fn().mockReturnValue(true) };
    const module = await Test.createTestingModule({
      controllers: [HealthDbController],
      providers: [
        { provide: getDataSourceToken(), useValue: ds },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    controller = module.get(HealthDbController);
  });

  it('db() reports ok with db up and redis up', async () => {
    const res = await controller.db();
    expect(ds.query).toHaveBeenCalledWith('SELECT 1');
    expect(res).toEqual({ status: 'ok', db: 'up', redis: 'up' });
  });

  it('db() reports redis down when cache not connected', async () => {
    cache.isConnected.mockReturnValue(false);
    const res = await controller.db();
    expect(res.redis).toBe('down');
    expect(res.db).toBe('up');
    expect(res.status).toBe('ok');
  });
});
