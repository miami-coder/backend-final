import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { VenuesService } from './venues.service';
import { Venue } from './entities/venue.entity';
import { ApiDataArrayResponse } from '../../common/swagger/response-helpers';

@ApiTags('Me / venues')
@ApiBearerAuth('access-token')
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeVenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get('venues')
  @ApiOperation({ summary: 'Заклади поточного користувача (усі статуси)' })
  @ApiDataArrayResponse({
    type: Venue,
    description: 'Список закладів користувача',
  })
  list(@CurrentUser() u: JwtUser) {
    return this.venues.listMineForUser(u.sub).then((data) => ({ data }));
  }
}
