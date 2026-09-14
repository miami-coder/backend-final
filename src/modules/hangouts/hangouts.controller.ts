import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  ApiDataArrayResponse,
  ApiDataResponse,
  ApiIdResponse,
  ApiPaginatedResponse,
} from '../../common/swagger/response-helpers';
import { HangoutsService } from './hangouts.service';
import { Hangout } from './entities/hangout.entity';
import { CreateHangoutDto } from './dto/create-hangout.dto';

@ApiTags('Hangouts')
@Controller()
export class HangoutsController {
  constructor(private readonly hangouts: HangoutsService) {}

  @Public()
  @Get('hangouts')
  @ApiOperation({ summary: 'Список публічних зустрічей (відкриті)' })
  @ApiPaginatedResponse({
    type: Hangout,
    description: 'Сторінкований список зустрічей',
  })
  @ApiQuery({
    name: 'venueId',
    required: false,
    type: String,
    description: 'Фільтр за закладом',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description: 'Фільтр за датою (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Статус: open | filled | cancelled | completed',
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
  list(
    @Query()
    q: {
      venueId?: string;
      date?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.hangouts.listPublic(q);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('venues/:venueId/hangouts')
  @Permissions('hangout:create')
  @ApiOperation({ summary: 'Створити зустріч у закладі' })
  @ApiDataResponse({
    status: 201,
    type: Hangout,
    description: 'Створена зустріч',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу hangout:create' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  @ApiBadRequestResponse({
    description: 'Невалідні дані (дата в минулому тощо)',
  })
  create(
    @CurrentUser() u: JwtUser,
    @Param('venueId') venueId: string,
    @Body() dto: CreateHangoutDto,
  ) {
    return this.hangouts.create(u.sub, venueId, dto).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('hangouts/:id/join')
  @Permissions('hangout:create')
  @ApiOperation({ summary: 'Приєднатися до зустрічі' })
  @ApiDataResponse({ type: Hangout, description: 'Оновлена зустріч' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiNotFoundResponse({ description: 'Зустріч не знайдено' })
  @ApiConflictResponse({ description: 'Заявка заповнена / вже приєднані' })
  join(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.hangouts.join(u.sub, id).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('hangouts/:id/leave')
  @ApiOperation({ summary: 'Покинути зустріч' })
  @ApiIdResponse({ description: 'ID покинутої зустрічі' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiNotFoundResponse({ description: 'Зустріч не знайдено' })
  @ApiForbiddenResponse({
    description: 'Творець не може залишити, поки є інші учасники',
  })
  leave(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.hangouts.leave(u.sub, id).then(() => ({ data: { id } }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('hangouts/:id/cancel')
  @ApiOperation({ summary: 'Скасувати зустріч (тільки творець)' })
  @ApiDataResponse({ type: Hangout, description: 'Скасована зустріч' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Тільки творець може скасувати' })
  @ApiNotFoundResponse({ description: 'Зустріч не знайдено' })
  cancel(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.hangouts.cancel(u.sub, id).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('hangouts/:id')
  @ApiOperation({ summary: 'Переглянути зустріч (тільки для учасників)' })
  @ApiDataResponse({
    type: Hangout,
    description: 'Деталі зустрічі з учасниками',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Ви не учасник цієї заявки' })
  @ApiNotFoundResponse({ description: 'Зустріч не знайдено' })
  get(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.hangouts.getForUser(u.sub, id).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me/hangouts')
  @ApiOperation({ summary: 'Мої зустрічі (створені / приєднані / всі)' })
  @ApiDataArrayResponse({
    type: Hangout,
    description: 'Список зустрічей користувача',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiQuery({
    name: 'role',
    required: true,
    enum: ['created', 'joined', 'all'],
    description: 'Які зустрічі показати',
  })
  myList(
    @CurrentUser() u: JwtUser,
    @Query('role') role: 'created' | 'joined' | 'all',
  ) {
    return this.hangouts.listMine(u.sub, role).then((data) => ({ data }));
  }
}
