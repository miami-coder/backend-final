import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { QueryVenuesDto } from './dto/query-venues.dto';
import { FileStorageService } from '../../common/services/file-storage.service';

@Controller('venues')
export class VenuesController {
  constructor(
    private readonly venues: VenuesService,
    private readonly storage: FileStorageService,
  ) {}

  @Public()
  @Get()
  list(@Query() q: QueryVenuesDto) {
    return this.venues.search(q);
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.venues.findOnePublic(id).then(async v => ({
      data: v,
    }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post()
  @Permissions('venue:create')
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateVenueDto) {
    return this.venues.create(u.sub, dto).then(v => ({ data: v }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch(':id')
  @Permissions('venue:edit:own', 'venue:edit:any')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venues.update(u.sub, id, dto).then(v => ({ data: v }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post(':id/photos')
  @Permissions('venue:edit:own', 'venue:edit:any')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const venue = await this.venues.findOneOrThrow(id);
    await this.venues.update(u.sub, id, {} as any); // noop, just assert edit
    const stored = await this.storage.save(`venues/${id}`, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    });
    return { data: stored };
  }
}
