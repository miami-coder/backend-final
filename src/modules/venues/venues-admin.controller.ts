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
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { VenuesService } from './venues.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { Venue, VenueStatus } from './entities/venue.entity';
import { UsersService } from '../users/users.service';
import {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../../common/swagger/response-helpers';

@ApiTags('Admin · Venues')
@ApiBearerAuth('access-token')
@Controller('admin/venues')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VenuesAdminController {
  constructor(
    private readonly venues: VenuesService,
    private readonly users: UsersService,
  ) {}

  @Get('pending')
  @Permissions('venue:moderate')
  @ApiOperation({ summary: 'Список закладів на модерації (pending)' })
  @ApiPaginatedResponse({
    type: Venue,
    description: 'Сторінкований список закладів',
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
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу venue:moderate' })
  list(@Query('page') page: number, @Query('limit') limit: number) {
    return this.venues.findPending(page, limit);
  }

  @Get('approved')
  @Permissions('venue:moderate')
  @ApiOperation({ summary: 'Список схвалених закладів (передача керування)' })
  @ApiPaginatedResponse({
    type: Venue,
    description: 'Сторінкований список схвалених закладів',
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
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу venue:moderate' })
  listApproved(@Query('page') page: number, @Query('limit') limit: number) {
    return this.venues.findApproved(page, limit);
  }

  @Post(':id/approve')
  @Permissions('venue:moderate')
  @ApiOperation({ summary: 'Схвалити заклад' })
  @ApiDataResponse({ type: Venue, description: 'Схвалений заклад' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу venue:moderate' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  approve(@Param('id') id: string) {
    return this.venues
      .changeStatus(id, VenueStatus.Approved)
      .then((v) => ({ data: v }));
  }

  @Post(':id/reject')
  @Permissions('venue:moderate')
  @ApiOperation({ summary: 'Відхилити заклад' })
  @ApiDataResponse({ type: Venue, description: 'Відхилений заклад' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу venue:moderate' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  reject(@Param('id') id: string, @Body() _dto: ChangeStatusDto) {
    return this.venues
      .changeStatus(id, VenueStatus.Rejected)
      .then((v) => ({ data: v }));
  }

  @Post(':id/assign-owner')
  @Permissions('user:manage')
  @ApiOperation({ summary: 'Призначити власника закладу' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { userId: { type: 'string', format: 'uuid' } },
      required: ['userId'],
    },
  })
  @ApiDataResponse({
    type: Venue,
    description: 'Оновлений заклад з новим власником',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу user:manage' })
  @ApiNotFoundResponse({ description: 'Заклад або користувач не знайдено' })
  async assignOwner(@Param('id') id: string, @Body('userId') userId: string) {
    const venue = await this.venues.findOneOrThrow(id);
    await this.users.findById(userId); // throws if not exists
    venue.ownerId = userId;
    return { data: await this.venues['venues'].save(venue) };
  }
}
