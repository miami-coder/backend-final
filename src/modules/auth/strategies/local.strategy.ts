import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UsersService } from '../../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Невірний email або пароль');
    if (!(await this.users.verifyPassword(user, password))) {
      throw new UnauthorizedException('Невірний email або пароль');
    }
    return { id: user.id, email: user.email };
  }
}
