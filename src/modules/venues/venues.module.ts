import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from './entities/venue.entity';
import { VenuePhoto } from './entities/venue-photo.entity';
import { VenueFeature } from './entities/venue-feature.entity';
import { VenueFeatureAssignment } from './entities/venue-feature-assignment.entity';
import { Tag } from './entities/tag.entity';
import { VenueTag } from './entities/venue-tag.entity';
import { VenueType } from './entities/venue-type.entity';
import { VenueTypeAssignment } from './entities/venue-type-assignment.entity';
import { VenuesService } from './venues.service';
import { RbacModule } from '../rbac/rbac.module';
import { UsersModule } from '../users/users.module';
import { VenueCacheListener } from './listeners/venue-cache.listener';
import { VenuesController } from './venues.controller';
import { VenuesAdminController } from './venues-admin.controller';
import { MeVenuesController } from './me-venues.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Venue,
      VenuePhoto,
      VenueFeature,
      VenueFeatureAssignment,
      Tag,
      VenueTag,
      VenueType,
      VenueTypeAssignment,
    ]),
    RbacModule,
    UsersModule,
  ],
  controllers: [VenuesController, VenuesAdminController, MeVenuesController],
  providers: [VenuesService, VenueCacheListener],
  exports: [VenuesService, TypeOrmModule],
})
export class VenuesModule {}
