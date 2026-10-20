import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AdminUsersService } from './admin-users.service';
import {
  ApiDataResponse,
  ApiIdResponse,
  ApiPaginatedResponse,
} from '../../common/swagger/response-helpers';

@ApiTags('Admin · Users')
@ApiBearerAuth('access-token')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @Permissions('user:manage')
  @ApiOperation({ summary: 'Список користувачів (без видалених)' })
  @ApiPaginatedResponse({
    type: User,
    description: 'Сторінкований список користувачів',
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
  @ApiForbiddenResponse({ description: 'Немає дозволу user:manage' })
  list(@Query('page') page: number, @Query('limit') limit: number) {
    return this.adminUsers.list(page, limit);
  }

  @Get(':id')
  @Permissions('user:manage')
  @ApiOperation({ summary: 'Деталі користувача' })
  @ApiDataResponse({ type: User, description: 'Користувач із профілем' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу user:manage' })
  @ApiNotFoundResponse({ description: 'Користувача не знайдено' })
  get(@Param('id') id: string) {
    return this.adminUsers.get(id);
  }

  @Patch(':id')
  @Permissions('user:manage')
  @ApiOperation({ summary: 'Оновити профіль користувача (адмін)' })
  @ApiDataResponse({ type: Profile, description: 'Оновлений профіль' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу user:manage' })
  @ApiNotFoundResponse({ description: 'Профіль не знайдено' })
  updateProfile(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.adminUsers.updateProfile(id, dto, u.sub);
  }

  @Delete(':id')
  @Permissions('user:manage')
  @ApiOperation({ summary: 'Мʼяко видалити користувача' })
  @ApiIdResponse({ description: 'ID видаленого користувача' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({
    description: 'Немає дозволу / не можна видалити себе',
  })
  @ApiNotFoundResponse({ description: 'Користувача не знайдено' })
  softDelete(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.adminUsers.softDelete(u.sub, id);
  }

  @Post(':id/roles')
  @Permissions('user:manage')
  @ApiOperation({ summary: 'Призначити / зняти роль користувача' })
  @ApiOkResponse({
    description: 'Результат операції над роллю',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            roleCode: { type: 'string' },
            action: { type: 'string', enum: ['add', 'remove'] },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiForbiddenResponse({ description: 'Немає дозволу user:manage' })
  @ApiNotFoundResponse({ description: 'Роль не знайдено' })
  assignRole(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.adminUsers.assignRole(u.sub, id, dto.roleCode, dto.action);
  }
}
