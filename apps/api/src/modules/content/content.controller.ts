import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ContentService } from './content.service';

class UpdateContentDto {
  @IsOptional() @IsString() @MaxLength(5000)
  value?: string | null;
}

@ApiTags('Content')
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get('content')
  @ApiOperation({ summary: 'Загальні тексти сайту («Про нас», контакти)' })
  list() {
    return this.content.getAll().then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('user:manage')
  @Patch('admin/content/:key')
  @ApiOperation({ summary: 'Супер-адмін: оновити загальний текст' })
  update(@Param('key') key: string, @Body() dto: UpdateContentDto) {
    return this.content
      .update(key, dto.value ?? null)
      .then((data) => ({ data }));
  }
}