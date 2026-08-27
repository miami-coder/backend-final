import {
  Body,
  Controller,
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
import { HangoutsService } from './hangouts.service';
import { CreateHangoutDto } from './dto/create-hangout.dto';

@Controller()
export class HangoutsController {
  constructor(private readonly hangouts: HangoutsService) {}

  @Public()
  @Get('hangouts')
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

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('venues/:venueId/hangouts')
  @Permissions('hangout:create')
  create(
    @CurrentUser() u: JwtUser,
    @Param('venueId') venueId: string,
    @Body() dto: CreateHangoutDto,
  ) {
    return this.hangouts.create(u.sub, venueId, dto).then((data) => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('hangouts/:id/join')
  @Permissions('hangout:create')
  join(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.hangouts.join(u.sub, id).then((data) => ({ data }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('hangouts/:id/leave')
  leave(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.hangouts.leave(u.sub, id).then(() => ({ data: { id } }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('hangouts/:id/cancel')
  cancel(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.hangouts.cancel(u.sub, id).then((data) => ({ data }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('hangouts/:id')
  get(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.hangouts.getForUser(u.sub, id).then((data) => ({ data }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/hangouts')
  myList(
    @CurrentUser() u: JwtUser,
    @Query('role') role: 'created' | 'joined' | 'all',
  ) {
    return this.hangouts.listMine(u.sub, role).then((data) => ({ data }));
  }
}
