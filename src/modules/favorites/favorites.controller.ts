import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';
import { FavoriteVenueDto } from './dto/favorite-venue.dto';
import { ApiPaginatedResponse } from '../../common/swagger/response-helpers';

@ApiTags('Favorites')
@ApiBearerAuth('access-token')
@Controller('me/favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post(':venueId')
  @ApiOperation({ summary: 'Додати заклад до обраних' })
  @ApiOkResponse({
    description: 'Заклад додано до обраних',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { venueId: { type: 'string', format: 'uuid' } },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  async add(@CurrentUser() u: JwtUser, @Param('venueId') id: string) {
    await this.favorites.add(u.sub, id);
    return { data: { venueId: id } };
  }

  @Delete(':venueId')
  @ApiOperation({ summary: 'Видалити заклад з обраних' })
  @ApiOkResponse({
    description: 'Заклад видалено з обраних',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { venueId: { type: 'string', format: 'uuid' } },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  async remove(@CurrentUser() u: JwtUser, @Param('venueId') id: string) {
    await this.favorites.remove(u.sub, id);
    return { data: { venueId: id } };
  }

  @Get()
  @ApiOperation({ summary: 'Список обраних закладів' })
  @ApiPaginatedResponse({
    type: FavoriteVenueDto,
    description: 'Сторінкований список обраних',
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
  list(
    @CurrentUser() u: JwtUser,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.favorites.list(u.sub, page, limit);
  }
}
