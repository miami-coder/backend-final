import { VenueCacheListener } from './venue-cache.listener';

describe('VenueCacheListener', () => {
  let venues: any;
  let listener: VenueCacheListener;

  beforeEach(() => {
    venues = { invalidateListCache: jest.fn() };
    listener = new VenueCacheListener(venues);
  });

  it('invalidate calls venues.invalidateListCache', async () => {
    venues.invalidateListCache.mockResolvedValue(undefined);
    await listener.invalidate();
    expect(venues.invalidateListCache).toHaveBeenCalledTimes(1);
  });

  it('invalidate awaits the cache call before resolving', async () => {
    let resolved = false;
    venues.invalidateListCache.mockImplementation(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            resolve();
            resolved = true;
          }, 5),
        ),
    );
    await listener.invalidate();
    expect(resolved).toBe(true);
  });
});
