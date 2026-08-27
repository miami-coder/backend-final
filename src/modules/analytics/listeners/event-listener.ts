import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AnalyticsService } from '../analytics.service';
import {
  VENUE_CREATED,
  VENUE_STATUS_CHANGED,
  VenueCreatedEvent,
  VenueStatusChangedEvent,
} from '../../venues/events';
import { REVIEW_CREATED } from '../../reviews/events';
import { HANGOUT_FILLED } from '../../hangouts/hangouts.service';

interface ReviewCreatedPayload {
  reviewId: string;
  venueId: string;
}

interface HangoutFilledPayload {
  hangoutId: string;
}

@Injectable()
export class AnalyticsEventListener {
  private readonly logger = new Logger(AnalyticsEventListener.name);
  constructor(private readonly analytics: AnalyticsService) {}

  @OnEvent(VENUE_CREATED)
  async onVenueCreated(payload: VenueCreatedEvent) {
    await this.analytics.recordEvent(payload.venueId, null, 'venue_created', {
      venueId: payload.venueId,
    });
  }

  @OnEvent(VENUE_STATUS_CHANGED)
  async onVenueStatusChanged(payload: VenueStatusChangedEvent) {
    await this.analytics.recordEvent(
      payload.venueId,
      null,
      'venue_status_changed',
      { venueId: payload.venueId, from: payload.from, to: payload.to },
    );
  }

  @OnEvent(REVIEW_CREATED)
  async onReviewCreated(payload: ReviewCreatedPayload) {
    await this.analytics.recordEvent(payload.venueId, null, 'review_created', {
      reviewId: payload.reviewId,
      venueId: payload.venueId,
    });
  }

  @OnEvent(HANGOUT_FILLED)
  async onHangoutFilled(payload: HangoutFilledPayload) {
    await this.analytics.recordEvent(null, null, 'hangout_filled', {
      hangoutId: payload.hangoutId,
    });
  }
}
