import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from './entities/news.entity';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { AdminNewsController } from './admin-news.controller';
import { VenuesModule } from '../venues/venues.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([News]), VenuesModule, RbacModule],
  providers: [NewsService],
  controllers: [NewsController, AdminNewsController],
  exports: [NewsService],
})
export class NewsModule {}
