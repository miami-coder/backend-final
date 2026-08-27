import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';

@Controller()
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Public()
  @Get('news')
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

  @Public()
  @Get('news/:id')
  get(@Param('id') id: string) {
    return this.news.get(id).then((data) => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('me/venues/:venueId/news')
  @Permissions('news:manage:own', 'news:manage:any')
  createForVenue(
    @CurrentUser() u: JwtUser,
    @Param('venueId') venueId: string,
    @Body() dto: CreateNewsDto,
  ) {
    return this.news.createForVenue(u.sub, venueId, dto).then((data) => ({
      data,
    }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch('news/:id')
  @Permissions('news:manage:own', 'news:manage:any')
  update(@Param('id') id: string, @Body() dto: Partial<CreateNewsDto>) {
    return this.news.update(id, dto).then((data) => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete('news/:id')
  @Permissions('news:manage:own', 'news:manage:any')
  remove(@Param('id') id: string) {
    return this.news.softDelete(id);
  }
}
