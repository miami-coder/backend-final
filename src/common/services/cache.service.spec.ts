import { Test } from '@nestjs/testing';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  const origHost = process.env.REDIS_HOST;
  const origPort = process.env.REDIS_PORT;

  beforeEach(async () => {
    // Направляємо на недосяжний порт, щоб no-op fallback-гілка відпрацьовувала
    // детерміновано, незалежно від того, чи запущено справжній Redis.
    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = '1';
    const module = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();
    service = module.get(CacheService);
  });

  afterEach(async () => {
    if (origHost === undefined) delete process.env.REDIS_HOST;
    else process.env.REDIS_HOST = origHost;
    if (origPort === undefined) delete process.env.REDIS_PORT;
    else process.env.REDIS_PORT = origPort;
  });

  it('returns null when redis is not connected', async () => {
    await service.onModuleInit();
    expect(await service.get('any-key')).toBeNull();
    expect(service.isConnected()).toBe(false);
    await service.onModuleDestroy();
  });

  it('set does not throw when redis is not connected', async () => {
    await service.onModuleInit();
    await expect(service.set('key', { a: 1 })).resolves.toBeUndefined();
    await expect(service.del('key')).resolves.toBeUndefined();
    await expect(service.delByPattern('pattern:*')).resolves.toBeUndefined();
    await service.onModuleDestroy();
  });
});
