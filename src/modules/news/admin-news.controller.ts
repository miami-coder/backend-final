import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { News } from './entities/news.entity';
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../../common/swagger/response-helpers';

@ApiTags('Admin · News')
@ApiBearerAuth('access-token')
@Controller('admin/news')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminNewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @Permissions('news:manage:any')
  @ApiOperation({ summary: 'Список новин (адмін, будь-який статус)' })
  @ApiPaginatedResponse({
    type: News,
    description: 'Сторінкований список новин',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Фільтр за категорією',
  })
  @ApiQuery({
    name: 'venueId',
    required: false,
    type: String,
    description: 'Фільтр за закладом',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Номер сторінки',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Розмір сторінки',
  })
  @ApiQuery({
    name: 'isPromoted',
    required: false,
    type: String,
    description: "'true' — лише промотовані",
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу news:manage:any' })
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
  @ApiOperation({ summary: 'Створити глобальну новину' })
  @ApiDataResponse({ status: 201, type: News, description: 'Створена новина' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу news:manage:any' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  createGlobal(@Body() dto: CreateNewsDto) {
    return this.news.createGlobal(dto).then((data) => ({ data }));
  }
}
