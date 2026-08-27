import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { FileStorageService } from '../../common/services/file-storage.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService, private readonly storage: FileStorageService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('venues/:venueId/reviews')
  @Permissions('review:create')
  @UseInterceptors(FileInterceptor('checkPhoto'))
  async create(
    @CurrentUser() u: JwtUser,
    @Param('venueId') venueId: string,
    @Body() dto: CreateReviewDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let checkPhotoUrl: string | undefined;
    if (file) {
      const stored = await this.storage.save(`reviews/${venueId}`, { originalname: file.originalname, mimetype: file.mimetype, size: file.size, buffer: file.buffer });
      checkPhotoUrl = stored.url;
    }
    const review = await this.reviews.create(u.sub, venueId, { ...dto, checkPhotoUrl });
    return { data: review };
  }

  @Public()
  @Get('venues/:venueId/reviews')
  list(@Param('venueId') venueId: string, @Query('page') page: number, @Query('limit') limit: number, @Query('sort') sort?: 'newest' | 'oldest' | 'highest' | 'lowest') {
    return this.reviews.listForVenue(venueId, page, limit, sort);
  }

  @Public()
  @Get('reviews/:id')
  get(@Param('id') id: string) {
    return this.reviews.findOneOrThrow(id).then(data => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch('reviews/:id')
  @Permissions('review:edit:own', 'review:edit:any')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviews.update(u.sub, id, dto).then(data => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete('reviews/:id')
  @Permissions('review:edit:own', 'review:edit:any')
  remove(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.reviews.softDelete(u.sub, id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('reviews/:id/feature')
  @Permissions('review:feature')
  feature(@Param('id') id: string) {
    return this.reviews.feature(id).then(data => ({ data }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/reviews')
  myReviews(@CurrentUser() u: JwtUser) {
    return this.reviews.listForUser(u.sub).then(data => ({ data }));
  }
}
