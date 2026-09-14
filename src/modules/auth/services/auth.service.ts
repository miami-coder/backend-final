import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../rbac/entities/user-role.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenService } from './jwt.service';
import { CacheService } from '../../../common/services/cache.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { USER_ROLE_ADDED } from '../../rbac/listeners/user-role.listener';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    private readonly tokens: TokenService,
    private readonly cache: CacheService,
    private readonly events: EventEmitter2,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.acceptEula) {
      throw new ConflictException('Потрібно прийняти угоду користувача');
    }
    const user = await this.users.create(dto);

    // Assign 'user' role
    const role = (await this.userRoles.manager.findOne('Role', {
      where: { code: 'user' },
    })) as { id: string } | null;
    if (role) {
      await this.userRoles.save({ userId: user.id, roleId: role.id });
      this.events.emit(USER_ROLE_ADDED, { userId: user.id });
    }

    const roles = await this.getUserRoles(user.id);
    return this.issueTokens(user.id, user.email, roles);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Невірний email або пароль');
    const ok = await this.users.verifyPassword(user, dto.password);
    if (!ok) throw new UnauthorizedException('Невірний email або пароль');
    const roles = await this.getUserRoles(user.id);
    return this.issueTokens(user.id, user.email, roles);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Невірний refresh token');
    }
    if (await this.cache.get(`revoked:${refreshToken}`)) {
      throw new UnauthorizedException('Refresh token скасований');
    }
    const user = await this.users.findById(payload.sub);
    const roles = await this.getUserRoles(user.id);
    // Rotate
    await this.cache.set(`revoked:${refreshToken}`, true, 60 * 60 * 24 * 30);
    return this.issueTokens(user.id, user.email, roles);
  }

  async logout(refreshToken: string) {
    await this.cache.set(`revoked:${refreshToken}`, true, 60 * 60 * 24 * 30);
  }

  async getRolesForUser(userId: string): Promise<string[]> {
    return this.getUserRoles(userId);
  }

  async issueTokensForUser(sub: string, email: string, roles: string[]) {
    return this.issueTokens(sub, email, roles);
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    const rows = await this.userRoles
      .createQueryBuilder('ur')
      .innerJoin('ur.role', 'r')
      .where('ur.userId = :userId', { userId })
      .select('r.code', 'code')
      .getRawMany<{ code: string }>();
    return rows.map((r) => r.code);
  }

  private issueTokens(sub: string, email: string, roles: string[]) {
    const accessToken = this.tokens.signAccess({ sub, email, roles });
    const refreshToken = this.tokens.signRefresh({ sub });
    return {
      accessToken,
      refreshToken,
      user: { id: sub, email, roles },
    };
  }
}
