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

@Controller()
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly venues: VenuesService,
    private readonly perms: PermissionsService,
  ) {}

  @Public()
  @Post('venues/:id/view')
  recordView(@Param('id') id: string, @Body() dto: RecordViewDto) {
    return this.analytics
      .recordView(id, null, dto.sessionId)
      .then((data) => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('me/venues/:id/analytics')
  @Permissions('analytics:view:own', 'analytics:view:all')
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

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('admin/analytics/overview')
  @Permissions('analytics:view:all')
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
