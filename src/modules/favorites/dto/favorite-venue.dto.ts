import { ApiProperty } from '@nestjs/swagger';

/**
 * Light venue projection returned by `GET /me/favorites` items.
 * Mirrors the mapped shape in `FavoritesService.list`.
 */
export class FavoriteVenueDto {
  @ApiProperty({ example: 'a1b2c3d4-...', description: 'ID закладу' })
  id: string;

  @ApiProperty({ example: 'Піцерія "Белла"' })
  name: string;

  @ApiProperty({ example: 'вул. Шевченка 12' })
  address: string;

  @ApiProperty({ example: 4.7, description: 'Середній рейтинг' })
  ratingAvg: number;

  @ApiProperty({ example: 'https://cdn.example.com/photo.jpg', nullable: true })
  mainPhotoUrl: string | null;
}
