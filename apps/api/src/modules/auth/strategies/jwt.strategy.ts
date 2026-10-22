import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtUser } from '../../../common/decorators/current-user.decorator';
import { CacheService } from '../../../common/services/cache.service';

interface JwtPayload {
  sub: string;
  email: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly cache?: CacheService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    // Видалений адміном юзер не може жити зі старим access-токеном
    //. Прапор кешується адмін-видаленням; на кожному хіті
    // TTL продовжується (sliding) — вікно не стухає до конці життя токена.
    if (this.cache) {
      const deleted = await this.cache.get(`deleted:${payload.sub}`);
      if (deleted) {
        await this.cache.set(`deleted:${payload.sub}`, true, 960);
        throw new UnauthorizedException('Обліковий запис видалено');
      }
    }
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
    };
  }
}
