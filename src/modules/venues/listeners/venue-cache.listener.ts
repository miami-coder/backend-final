import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { VenuesService } from '../venues.service';
import { VENUE_CREATED, VENUE_UPDATED, VENUE_STATUS_CHANGED } from '../events';

@Injectable()
export class VenueCacheListener {
  private readonly logger = new Logger(VenueCacheListener.name);

  constructor(private readonly venues: VenuesService) {}

  @OnEvent(VENUE_CREATED)
  @OnEvent(VENUE_UPDATED)
  @OnEvent(VENUE_STATUS_CHANGED)
  async invalidate() {
    await this.venues.invalidateListCache();
  }
}
