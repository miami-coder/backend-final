import { HangoutCron } from './hangout-cron';

describe('HangoutCron', () => {
  let cron: HangoutCron;
  let hangouts: any;

  beforeEach(() => {
    hangouts = { markCompletedBatch: jest.fn() };
    cron = new HangoutCron(hangouts);
  });

  it('calls markCompletedBatch on tick', async () => {
    hangouts.markCompletedBatch.mockResolvedValue(3);
    await cron.markPastHangoutsCompleted();
    expect(hangouts.markCompletedBatch).toHaveBeenCalled();
  });

  it('does not throw when count is zero', async () => {
    hangouts.markCompletedBatch.mockResolvedValue(0);
    await expect(cron.markPastHangoutsCompleted()).resolves.toBeUndefined();
    expect(hangouts.markCompletedBatch).toHaveBeenCalled();
  });
});
