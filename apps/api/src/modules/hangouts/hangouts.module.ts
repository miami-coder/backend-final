import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hangout } from './entities/hangout.entity';
import { HangoutParticipant } from './entities/hangout-participant.entity';
import { HangoutsService } from './hangouts.service';
import { HangoutsController } from './hangouts.controller';
import { HangoutCron } from './cron/hangout-cron';
import { HangoutCacheListener } from './listeners/hangout-cache.listener';
import { VenuesModule } from '../venues/venues.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hangout, HangoutParticipant]),
    VenuesModule,
  ],
  providers: [HangoutsService, HangoutCron, HangoutCacheListener],
  controllers: [HangoutsController],
  exports: [HangoutsService],
})
export class HangoutsModule {}
