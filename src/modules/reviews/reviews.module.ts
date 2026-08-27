import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { Venue } from '../venues/entities/venue.entity';
import { ReviewsService } from './reviews.service';
import { RatingRecalcListener } from './listeners/rating-recalc.listener';
import { RbacModule } from '../rbac/rbac.module';
import { VenuesModule } from '../venues/venues.module';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Venue]), RbacModule, VenuesModule],
  providers: [ReviewsService, RatingRecalcListener],
  exports: [ReviewsService],
})
export class ReviewsModule {}
