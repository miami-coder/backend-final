import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { VenuesService } from './venues.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { VenueStatus } from './entities/venue.entity';
import { UsersService } from '../users/users.service';

@Controller('admin/venues')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VenuesAdminController {
  constructor(
    private readonly venues: VenuesService,
    private readonly users: UsersService,
  ) {}

  @Get('pending')
  @Permissions('venue:moderate')
  list(@Query('page') page: number, @Query('limit') limit: number) {
    return this.venues.findPending(page, limit);
  }

  @Post(':id/approve')
  @Permissions('venue:moderate')
  approve(@Param('id') id: string) {
    return this.venues.changeStatus(id, VenueStatus.Approved).then(v => ({ data: v }));
  }

  @Post(':id/reject')
  @Permissions('venue:moderate')
  reject(@Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.venues.changeStatus(id, VenueStatus.Rejected).then(v => ({ data: v }));
  }

  @Post(':id/assign-owner')
  @Permissions('user:manage')
  async assignOwner(@Param('id') id: string, @Body('userId') userId: string) {
    const venue = await this.venues.findOneOrThrow(id);
    await this.users.findById(userId); // throws if not exists
    venue.ownerId = userId;
    return { data: await this.venues['venues'].save(venue) };
  }
}
