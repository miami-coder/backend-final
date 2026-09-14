import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review } from './entities/review.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  ApiDataArrayResponse,
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../../common/swagger/response-helpers';
import { FileStorageService } from '../../common/services/file-storage.service';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly storage: FileStorageService,
  ) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('venues/:venueId/reviews')
  @Permissions('review:create')
  @UseInterceptors(FileInterceptor('checkPhoto'))
  @ApiOperation({
    summary: 'Створити відгук на заклад (з можливим фото чека)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Поля відгуку як form-data; додайте файл у поле `checkPhoto` (зображення чека, необовʼязково).',
    type: CreateReviewDto,
  })
  @ApiDataResponse({
    status: 201,
    type: Review,
    description: 'Створений відгук',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу review:create' })
  @ApiNotFoundResponse({ description: 'Заклад не знайдено' })
  @ApiBadRequestResponse({ description: 'Невалідні дані / дублікат відгуку' })
  async create(
    @CurrentUser() u: JwtUser,
    @Param('venueId') venueId: string,
    @Body() dto: CreateReviewDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let checkPhotoUrl: string | undefined;
    if (file) {
      const stored = await this.storage.save(`reviews/${venueId}`, {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      });
      checkPhotoUrl = stored.url;
    }
    const review = await this.reviews.create(u.sub, venueId, {
      ...dto,
      checkPhotoUrl,
    });
    return { data: review };
  }

  @Public()
  @Get('venues/:venueId/reviews')
  @ApiOperation({ summary: 'Список відгуків закладу' })
  @ApiPaginatedResponse({
    type: Review,
    description: 'Сторінкований список відгуків',
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
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['newest', 'oldest', 'highest', 'lowest'],
    description: 'Сортування',
  })
  list(
    @Param('venueId') venueId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: 'newest' | 'oldest' | 'highest' | 'lowest',
  ) {
    return this.reviews.listForVenue(venueId, page, limit, sort);
  }

  @Public()
  @Get('reviews/:id')
  @ApiOperation({ summary: 'Переглянути відгук' })
  @ApiDataResponse({ type: Review, description: 'Деталі відгуку' })
  @ApiNotFoundResponse({ description: 'Відгук не знайдено' })
  get(@Param('id') id: string) {
    return this.reviews.findOneOrThrow(id).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch('reviews/:id')
  @Permissions('review:edit:own', 'review:edit:any')
  @ApiOperation({ summary: 'Оновити відгук (автор або модератор)' })
  @ApiDataResponse({ type: Review, description: 'Оновлений відгук' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає права редагувати цей відгук' })
  @ApiNotFoundResponse({ description: 'Відгук не знайдено' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  update(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviews.update(u.sub, id, dto).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete('reviews/:id')
  @Permissions('review:edit:own', 'review:edit:any')
  @ApiOperation({ summary: 'Видалити відгук (мʼяке видалення)' })
  @ApiOkResponse({ description: 'Відгук видалено' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає права видалити цей відгук' })
  @ApiNotFoundResponse({ description: 'Відгук не знайдено' })
  remove(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.reviews.softDelete(u.sub, id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('reviews/:id/feature')
  @Permissions('review:feature')
  @ApiOperation({ summary: 'Виділити відгук (закріпити)' })
  @ApiDataResponse({ type: Review, description: 'Виділений відгук' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу review:feature' })
  @ApiNotFoundResponse({ description: 'Відгук не знайдено' })
  feature(@Param('id') id: string) {
    return this.reviews.feature(id).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me/reviews')
  @ApiOperation({ summary: 'Мої відгуки' })
  @ApiDataArrayResponse({
    type: Review,
    description: 'Список відгуків користувача',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  myReviews(@CurrentUser() u: JwtUser) {
    return this.reviews.listForUser(u.sub).then((data) => ({ data }));
  }
}
