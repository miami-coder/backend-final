import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HangoutsService } from '../hangouts.service';

@Injectable()
export class HangoutCron {
  private readonly logger = new Logger(HangoutCron.name);
  constructor(private readonly hangouts: HangoutsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async markPastHangoutsCompleted() {
    const count = await this.hangouts.markCompletedBatch();
    if (count > 0)
      this.logger.log(`Marked ${count} past hangouts as completed`);
  }
}
