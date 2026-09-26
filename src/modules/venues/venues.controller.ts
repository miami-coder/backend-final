import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { QueryVenuesDto } from './dto/query-venues.dto';
import { Venue } from './entities/venue.entity';
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../../common/swagger/response-helpers';

@ApiTags('Venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Пошук закладів із фільтрами' })
  @ApiPaginatedResponse({
    type: Venue,
    description: 'Сторінкований список закладів',
  })
  list(@Query() q: QueryVenuesDto) {
    return this.venues.search(q);
  }

  @Public()
  @Get('tags')
  @ApiOperation({ summary: 'Довідник тегів закладів (з кількістю закладів)' })
  @ApiOkResponse({
    description: 'Список тегів',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              venueCount: { type: 'number' },
            },
          },
        },
      },
    },
  })
  listTags() {
    return this.venues.listTags().then((data) => ({ data }));
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Публічні деталі закладу' })
  @ApiDataResponse({ type: Venue, description: 'Деталі закладу' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  get(@Param('id') id: string) {
    return this.venues.findOnePublic(id).then((v) => ({ data: v }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post()
  @Permissions('venue:create')
  @ApiOperation({ summary: 'Створити заклад' })
  @ApiDataResponse({
    status: 201,
    type: Venue,
    description: 'Створений заклад',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу venue:create' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateVenueDto) {
    return this.venues.create(u.sub, dto).then((v) => ({ data: v }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch(':id')
  @Permissions('venue:edit:own', 'venue:edit:any')
  @ApiOperation({ summary: 'Оновити заклад (власник або модератор)' })
  @ApiDataResponse({ type: Venue, description: 'Оновлений заклад' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає права редагувати цей заклад' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  update(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateVenueDto,
  ) {
    return this.venues.update(u.sub, id, dto).then((v) => ({ data: v }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete(':id')
  @Permissions('venue:edit:own', 'venue:edit:any')
  @HttpCode(204)
  @ApiOperation({ summary: 'Видалити заклад (м’яко: статус Archived)' })
  @ApiOkResponse({ description: 'Заклад архівовано' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає права редагувати цей заклад' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  remove(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.venues.softDelete(u.sub, id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post(':id/photos')
  @Permissions('venue:edit:own', 'venue:edit:any')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Завантажити фото закладу' })
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
  @ApiForbiddenResponse({ description: 'Немає права редагувати цей заклад' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  async uploadPhoto(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return { data: await this.venues.uploadPhoto(u.sub, id, file) };
  }
}
