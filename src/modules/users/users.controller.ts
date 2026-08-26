import { Body, Controller, Get, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { UseGuards } from '@nestjs/common';

@Controller('me')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() current: JwtUser) {
    const user = await this.users.findById(current.sub);
    const profile = await this.users.getProfile(current.sub);
    return {
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        roles: current.roles,
        profile: { firstname: profile.firstname, lastname: profile.lastname, age: profile.age, phone: profile.phone, avatarUrl: profile.avatarUrl },
      },
    };
  }

  @Patch('profile')
  @Permissions() // no specific perm required, just auth
  async updateProfile(@CurrentUser() current: JwtUser, @Body() dto: UpdateProfileDto) {
    const profile = await this.users.updateProfile(current.sub, dto);
    return { data: profile };
  }
}
