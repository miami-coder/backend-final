import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { News } from './entities/news.entity';
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../../common/swagger/response-helpers';

@ApiTags('News')
@Controller()
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Public()
  @Get('news')
  @ApiOperation({ summary: 'Список публічних новин' })
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
  @ApiOperation({ summary: 'Переглянути новину' })
  @ApiDataResponse({ type: News, description: 'Деталі новини' })
  @ApiNotFoundResponse({ description: 'Новину не знайдено' })
  get(@Param('id') id: string) {
    return this.news.get(id).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('me/venues/:venueId/news')
  @Permissions('news:manage:own', 'news:manage:any')
  @ApiOperation({ summary: 'Створити новину для закладу' })
  @ApiDataResponse({ status: 201, type: News, description: 'Створена новина' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу news:manage' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  createForVenue(
    @CurrentUser() u: JwtUser,
    @Param('venueId') venueId: string,
    @Body() dto: CreateNewsDto,
  ) {
    return this.news.createForVenue(u.sub, venueId, dto).then((data) => ({
      data,
    }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch('news/:id')
  @Permissions('news:manage:own', 'news:manage:any')
  @ApiOperation({ summary: 'Оновити новину' })
  @ApiDataResponse({ type: News, description: 'Оновлена новина' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу news:manage' })
  @ApiNotFoundResponse({ description: 'Новину не знайдено' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  update(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<CreateNewsDto>,
  ) {
    return this.news.update(id, u.sub, dto).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete('news/:id')
  @Permissions('news:manage:own', 'news:manage:any')
  @ApiOperation({ summary: 'Видалити новину (мʼяке видалення)' })
  @ApiOkResponse({ description: 'Новину видалено' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу news:manage' })
  @ApiNotFoundResponse({ description: 'Новину не знайдено' })
  remove(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.news.softDelete(id, u.sub);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('news/:id/photo')
  @Permissions('news:manage:own', 'news:manage:any')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Завантажити фото новини' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    description: 'URL завантаженого фото',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'object', properties: { url: { type: 'string' } } },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу news:manage' })
  @ApiNotFoundResponse({ description: 'Новину не знайдено' })
  async uploadPhoto(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return { data: await this.news.uploadPhoto(id, u.sub, file) };
  }
}
