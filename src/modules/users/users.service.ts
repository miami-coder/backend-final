import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { Role } from '../rbac/entities/role.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { RoleCode } from '../rbac/entities/role.enum';
import { PermissionsService } from '../rbac/permissions.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const BCRYPT_COST = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(OAuthAccount)
    private readonly oauth: Repository<OAuthAccount>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    private readonly perms: PermissionsService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.users.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing)
      throw new ConflictException('Користувач з таким email вже існує');
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    let user = this.users.create({
      email: dto.email.toLowerCase(),
      passwordHash,
    });
    user = await this.users.save(user);
    const profile = this.profiles.create({
      userId: user.id,
      firstname: dto.firstname,
      lastname: dto.lastname,
      age: dto.age ?? null,
      phone: dto.phone ?? null,
    });
    await this.profiles.save(profile);
    return user;
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  async getProfile(userId: string): Promise<Profile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Профіль не знайдено');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    const profile = await this.getProfile(userId);
    Object.assign(profile, dto);
    return this.profiles.save(profile);
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  async findOrCreateOAuthUser(
    email: string,
    provider: string,
    providerUserId: string,
    names: { firstname: string; lastname: string },
  ): Promise<User> {
    const existingAccount = await this.oauth.findOne({
      where: { provider, providerUserId },
    });
    if (existingAccount) {
      const existing = await this.findById(existingAccount.userId);
      // soft-видалений (адмін-видалення) акаунт, який заходить знову, — оживає
      if (existing.deletedAt) await this.restoreAccount(existing.id);
      // бекфілл старих акаунтів, створених без ролі
      else await this.ensureUserRole(existing.id);
      return existing;
    }

    let user = await this.findByEmail(email);
    if (user && user.deletedAt) {
      // не створюємо дубля за email — відновлюємо наявний акаунт
      await this.restoreAccount(user.id);
    } else if (!user) {
      user = this.users.create({
        email: email.toLowerCase(),
        passwordHash: null,
        emailVerified: true,
      });
      user = await this.users.save(user);
      await this.profiles.save(
        this.profiles.create({
          userId: user.id,
          firstname: names.firstname,
          lastname: names.lastname,
        }),
      );
    }
    await this.oauth.save(
      this.oauth.create({ userId: user.id, provider, providerUserId }),
    );
    await this.ensureUserRole(user.id);
    return user;
  }

  /** Soft-видалений акаунт (.deletedAt) знову заходить (OAuth або паролем):
   *  знімаємо прапор видалення й гарантуємо дефолтну роль — акаунт оживає. */
  async restoreAccount(userId: string): Promise<void> {
    await this.users.update({ id: userId }, { deletedAt: null });
    await this.ensureUserRole(userId);
  }

  // Дефолтна роль — паритет із register(): OAuth-користувач мусить мати 'user'.
  // Ідемпотентно; бекфілить і старі oauth-акаунти, створені до цього виправлення.
  private async ensureUserRole(userId: string): Promise<void> {
    const role = await this.roleRepo.findOne({
      where: { code: RoleCode.User },
    });
    if (!role) return;
    const existing = await this.userRoles.findOne({
      where: { userId, roleId: role.id },
    });
    if (existing) return;
    await this.userRoles.save({ userId, roleId: role.id });
    // кеш пермішенів (TTL 5 хв) треба скинути, щоб роль набрала сили одразу
    await this.perms.invalidate(userId);
  }
}
