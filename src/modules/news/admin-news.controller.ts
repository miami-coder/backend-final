import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';

@Controller('admin/news')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminNewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @Permissions('news:manage:any')
  list(
    @Query()
    q: {
      category?: string;
      venueId?: string;
      page?: number;
      limit?: number;
      isPromoted?: string;
    },
  ) {
    return this.news.listPublic({
      ...q,
      isPromoted: q.isPromoted === 'true' ? true : undefined,
    });
  }

  @Post()
  @Permissions('news:manage:any')
  createGlobal(@Body() dto: CreateNewsDto) {
    return this.news.createGlobal(dto).then((data) => ({ data }));
  }
}
