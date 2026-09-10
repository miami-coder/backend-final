import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PermissionsService } from '../rbac/permissions.service';
import { VenuesService } from './venues.service';
import { Venue } from './entities/venue.entity';
import {
  ApiDataArrayResponse,
  ApiDataResponse,
} from '../../common/swagger/response-helpers';

@ApiTags('Me / venues')
@ApiBearerAuth('access-token')
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeVenuesController {
  constructor(
    private readonly venues: VenuesService,
    private readonly perms: PermissionsService,
  ) {}

  @Get('venues')
  @ApiOperation({ summary: 'Заклади поточного користувача (усі статуси)' })
  @ApiDataArrayResponse({
    type: Venue,
    description: 'Список закладів користувача',
  })
  list(@CurrentUser() u: JwtUser) {
    return this.venues.listMineForUser(u.sub).then((data) => ({ data }));
  }

  @Get('venues/:id')
  @ApiOperation({
    summary: 'Свій заклад незалежно від статусу (власник або venue:edit:any)',
  })
  @ApiDataResponse({ type: Venue, description: 'Заклад з relations' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  @ApiForbiddenResponse({ description: 'Немає доступу до цього закладу' })
  async get(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    const venue = await this.venues.findOneForOwnerQuery(id);
    if (!venue) throw new NotFoundException('Заклад не знайдено');
    if (venue.ownerId !== u.sub) {
      const canAny = await this.perms.hasPermission(u.sub, 'venue:edit:any');
      if (!canAny)
        throw new ForbiddenException('Немає доступу до цього закладу');
    }
    return { data: venue };
  }
}
