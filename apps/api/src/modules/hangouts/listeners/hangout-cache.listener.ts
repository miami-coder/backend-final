import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HangoutsService } from '../hangouts.service';
import { HANGOUT_CANCELLED, HANGOUT_FILLED } from '../hangouts.service';

@Injectable()
export class HangoutCacheListener {
  constructor(private readonly hangouts: HangoutsService) {}

  @OnEvent(HANGOUT_FILLED)
  @OnEvent(HANGOUT_CANCELLED)
  async invalidate() {
    await this.hangouts.invalidateListCache();
  }
}
