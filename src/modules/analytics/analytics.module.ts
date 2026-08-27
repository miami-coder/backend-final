import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VenueView } from './entities/venue-view.entity';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsEventListener } from './listeners/event-listener';
import { VenuesModule } from '../venues/venues.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VenueView, AnalyticsEvent]),
    VenuesModule,
    RbacModule,
  ],
  providers: [AnalyticsService, AnalyticsEventListener],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
