import { Injectable } from '@nestjs/common';
import { JwtService as NestJwt } from '@nestjs/jwt';

@Injectable()
export class TokenService {
  constructor(private readonly jwt: NestJwt) {}

  signAccess(payload: { sub: string; email: string; roles: string[] }): string {
    return this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as any,
    });
  }

  signRefresh(payload: { sub: string }): string {
    return this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: (process.env.JWT_REFRESH_TTL ?? '30d') as any,
    });
  }

  verifyAccess(token: string): { sub: string; email: string; roles: string[] } {
    return this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET });
  }

  verifyRefresh(token: string): { sub: string } {
    return this.jwt.verify(token, { secret: process.env.JWT_REFRESH_SECRET });
  }
}
