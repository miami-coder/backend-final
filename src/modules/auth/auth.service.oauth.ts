import { Injectable } from '@nestjs/common';
import { AuthService } from './services/auth.service';

@Injectable()
export class OAuthHandlerService {
  constructor(private readonly auth: AuthService) {}

  /**
   * Called after OAuth strategy returns user; issues tokens and returns redirect URL.
   */
  async buildRedirectUrl(user: { id: string; email: string }): Promise<string> {
    const roles = await this.auth.getRolesForUser(user.id);
    const { accessToken, refreshToken } = await this.auth.issueTokensForUser(
      user.id,
      user.email,
      roles,
    );
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const params = new URLSearchParams({
      access: accessToken,
      refresh: refreshToken,
    });
    return `${frontend}/auth/callback?${params.toString()}`;
  }
}
