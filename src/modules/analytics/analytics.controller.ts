import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
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
import { AnalyticsService } from './analytics.service';
import { RecordViewDto } from './dto/record-view.dto';
import { VenuesService } from '../venues/venues.service';
import { PermissionsService } from '../rbac/permissions.service';

@ApiTags('Analytics')
@Controller()
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly venues: VenuesService,
    private readonly perms: PermissionsService,
  ) {}

  @Public()
  @Post('venues/:id/view')
  @ApiOperation({ summary: 'Записати перегляд закладу (з дедуплікацією)' })
  @ApiOkResponse({
    description: 'Чи було записано перегляд',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { recorded: { type: 'boolean' } },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  recordView(@Param('id') id: string, @Body() dto: RecordViewDto) {
    return this.analytics
      .recordView(id, null, dto.sessionId)
      .then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('me/venues/:id/analytics')
  @Permissions('analytics:view:own', 'analytics:view:all')
  @ApiOperation({ summary: 'Аналітика закладу (власник або модератор)' })
  @ApiOkResponse({
    description: 'Метрики переглядів та подій',
    schema: {
      type: 'object',
      properties: {
        totalViews: { type: 'number' },
        viewsByDay: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '2026-08-01' },
              count: { type: 'number' },
            },
          },
        },
        eventsByType: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              eventType: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({
    description: 'Немає доступу до аналітики цього закладу',
  })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    description: 'Дата з (ISO)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'Дата по (ISO)',
  })
  getForVenue(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.assertOwnerOrAll(u.sub, id).then(() =>
      this.analytics.getForVenue(id, from, to),
    );
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('admin/analytics/overview')
  @Permissions('analytics:view:all')
  @ApiOperation({ summary: 'Загальна аналітика по всій системі' })
  @ApiOkResponse({
    description: 'Загальні метрики',
    schema: {
      type: 'object',
      properties: {
        totalViews: { type: 'number' },
        totalEvents: { type: 'number' },
        eventsByType: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              eventType: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу analytics:view:all' })
  getOverview() {
    return this.analytics.getOverview();
  }

  private async assertOwnerOrAll(userId: string, venueId: string) {
    if (await this.perms.hasPermission(userId, 'analytics:view:all')) return;
    const venue = await this.venues.findOneOrThrow(venueId);
    if (venue.ownerId !== userId) {
      throw new ForbiddenException('Немає доступу до аналітики цього закладу');
    }
  }
}
