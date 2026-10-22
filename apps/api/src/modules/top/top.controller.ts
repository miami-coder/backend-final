import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { TopService } from './top.service';
import {
  CreateTopCategoryDto,
  CreateTopEntryDto,
  ReorderTopCategoriesDto,
  ReorderTopEntriesDto,
  UpdateTopCategoryDto,
} from './dto/top.dto';

@ApiTags('Top')
@Controller()
export class TopController {
  constructor(private readonly top: TopService) {}

  @Public()
  @Get('top')
  @ApiOperation({
    summary: 'Публічний Топ: категорії і заклади в них (редагує супер-адмін)',
  })
  list() {
    return this.top.listPublic().then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('user:manage')
  @Get('admin/top/categories')
  @ApiOperation({ summary: 'Адмін: категорії Топу з записами' })
  adminList() {
    return this.top.listAdmin().then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('user:manage')
  @Post('admin/top/categories')
  @ApiOperation({ summary: 'Адмін: створити категорію Топу' })
  createCategory(@Body() dto: CreateTopCategoryDto) {
    return this.top.createCategory(dto).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('user:manage')
  @Post('admin/top/categories/reorder')
  @ApiOperation({
    summary: 'Адмін: новий порядок категорій Топу (полний список айді)',
  })
  reorderCategories(@Body() dto: ReorderTopCategoriesDto) {
    return this.top.reorderCategories(dto.categoryIds).then(() => ({
      data: { reordered: dto.categoryIds.length },
    }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('user:manage')
  @Patch('admin/top/categories/:id')
  @ApiOperation({ summary: 'Адмін: оновити категорію Топу' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateTopCategoryDto) {
    return this.top.updateCategory(id, dto).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('user:manage')
  @Delete('admin/top/categories/:id')
  @ApiOperation({ summary: 'Адмін: видалити категорію Топу (з записами)' })
  async deleteCategory(@Param('id') id: string) {
    await this.top.deleteCategory(id);
    return { data: { id } };
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('user:manage')
  @Post('admin/top/categories/:id/entries')
  @ApiOperation({ summary: 'Адмін: додати заклад у категорію Топу' })
  addEntry(@Param('id') id: string, @Body() dto: CreateTopEntryDto) {
    return this.top.addEntry(id, dto).then((data) => ({ data }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('user:manage')
  @Post('admin/top/categories/:id/entries/reorder')
  @ApiOperation({
    summary: 'Адмін: новий порядок записів категорії (полний список айді)',
  })
  reorderEntries(
    @Param('id') id: string,
    @Body() dto: ReorderTopEntriesDto,
  ) {
    return this.top.reorderEntries(id, dto.entryIds).then(() => ({
      data: { reordered: dto.entryIds.length },
    }));
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('user:manage')
  @Delete('admin/top/categories/:id/entries/:entryId')
  @ApiOperation({ summary: 'Адмін: прибрати заклад з категорії Топу' })
  async removeEntry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ) {
    await this.top.removeEntry(id, entryId);
    return { data: { entryId } };
  }
}
