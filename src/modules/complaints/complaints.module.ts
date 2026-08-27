import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Complaint } from './entities/complaint.entity';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { AdminComplaintsController } from './admin-complaints.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Complaint])],
  providers: [ComplaintsService],
  controllers: [ComplaintsController, AdminComplaintsController],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
