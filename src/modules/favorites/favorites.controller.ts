import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';

@Controller('me/favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post(':venueId')
  async add(@CurrentUser() u: JwtUser, @Param('venueId') id: string) {
    await this.favorites.add(u.sub, id);
    return { data: { venueId: id } };
  }

  @Delete(':venueId')
  async remove(@CurrentUser() u: JwtUser, @Param('venueId') id: string) {
    await this.favorites.remove(u.sub, id);
    return { data: { venueId: id } };
  }

  @Get()
  list(
    @CurrentUser() u: JwtUser,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.favorites.list(u.sub, page, limit);
  }
}
