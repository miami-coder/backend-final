import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteContent } from './site-content.entity';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SiteContent])],
  providers: [ContentService],
  controllers: [ContentController],
})
export class ContentModule {}