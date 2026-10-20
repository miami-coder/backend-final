import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopCategory } from './top-category.entity';
import { TopEntry } from './top-entry.entity';
import { TopService } from './top.service';
import { TopController } from './top.controller';
import { Venue } from '../venues/entities/venue.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TopCategory, TopEntry, Venue])],
  providers: [TopService],
  controllers: [TopController],
})
export class TopModule {}
