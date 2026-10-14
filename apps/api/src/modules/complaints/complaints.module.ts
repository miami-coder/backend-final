import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Complaint } from './entities/complaint.entity';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { AdminComplaintsController } from './admin-complaints.controller';
import { VenueComplaintsController } from './venue-complaints.controller';
import { VenuesModule } from '../venues/venues.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([Complaint]), VenuesModule, RbacModule],
  providers: [ComplaintsService],
  controllers: [ComplaintsController, AdminComplaintsController, VenueComplaintsController],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
