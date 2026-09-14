import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { Profile } from './entities/profile.entity';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ApiDataResponse } from '../../common/swagger/response-helpers';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('me')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Поточний профіль користувача' })
  @ApiDataResponse({
    type: MeResponseDto,
    description: 'Дані користувача з профілем',
  })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  async me(@CurrentUser() current: JwtUser) {
    const user = await this.users.findById(current.sub);
    const profile = await this.users.getProfile(current.sub);
    return {
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        roles: current.roles,
        profile: {
          firstname: profile.firstname,
          lastname: profile.lastname,
          age: profile.age,
          phone: profile.phone,
          avatarUrl: profile.avatarUrl,
        },
      },
    };
  }

  @Patch('profile')
  @Permissions() // no specific perm required, just auth
  @ApiOperation({ summary: 'Оновити свій профіль' })
  @ApiDataResponse({ type: Profile, description: 'Оновлений профіль' })
  @ApiUnauthorizedResponse({ description: 'Не авторизований' })
  @ApiNotFoundResponse({ description: 'Профіль не знайдено' })
  @ApiBadRequestResponse({ description: 'Невалідні дані' })
  async updateProfile(
    @CurrentUser() current: JwtUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const profile = await this.users.updateProfile(current.sub, dto);
    return { data: profile };
  }
}
