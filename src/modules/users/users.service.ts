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
  ) {}

  async create(dto: CreateUserDto, roleCode: string = 'user'): Promise<User> {
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
    if (existingAccount) return this.findById(existingAccount.userId);

    let user = await this.findByEmail(email);
    if (!user) {
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
    return user;
  }
}
