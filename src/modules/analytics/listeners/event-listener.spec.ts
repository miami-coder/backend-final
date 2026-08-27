import { AnalyticsEventListener } from './event-listener';

describe('AnalyticsEventListener', () => {
  let analytics: any;
  let listener: AnalyticsEventListener;

  beforeEach(() => {
    analytics = { recordEvent: jest.fn() };
    listener = new AnalyticsEventListener(analytics);
  });

  it('onVenueCreated records venue_created event', async () => {
    await listener.onVenueCreated({ venueId: 'v1' } as any);
    expect(analytics.recordEvent).toHaveBeenCalledWith(
      'v1',
      null,
      'venue_created',
      {
        venueId: 'v1',
      },
    );
  });

  it('onVenueStatusChanged records status change with from/to', async () => {
    await listener.onVenueStatusChanged({
      venueId: 'v1',
      from: 'pending',
      to: 'published',
    } as any);
    expect(analytics.recordEvent).toHaveBeenCalledWith(
      'v1',
      null,
      'venue_status_changed',
      { venueId: 'v1', from: 'pending', to: 'published' },
    );
  });

  it('onReviewCreated records review_created event', async () => {
    await listener.onReviewCreated({ reviewId: 'r1', venueId: 'v1' });
    expect(analytics.recordEvent).toHaveBeenCalledWith(
      'v1',
      null,
      'review_created',
      {
        reviewId: 'r1',
        venueId: 'v1',
      },
    );
  });

  it('onHangoutFilled records hangout_filled event with null venueId', async () => {
    await listener.onHangoutFilled({ hangoutId: 'h1' });
    expect(analytics.recordEvent).toHaveBeenCalledWith(
      null,
      null,
      'hangout_filled',
      {
        hangoutId: 'h1',
      },
    );
  });
});
