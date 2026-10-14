import { HangoutCacheListener } from './hangout-cache.listener';

describe('HangoutCacheListener', () => {
  let listener: HangoutCacheListener;
  let hangouts: any;

  beforeEach(() => {
    hangouts = { invalidateListCache: jest.fn().mockResolvedValue(undefined) };
    listener = new HangoutCacheListener(hangouts);
  });

  it('invalidates list cache on event', async () => {
    await listener.invalidate();
    expect(hangouts.invalidateListCache).toHaveBeenCalled();
  });
});
