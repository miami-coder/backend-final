import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { UsersService } from '../../users/users.service';

interface GoogleProfile {
  id: string;
  displayName?: string;
  name?: { givenName?: string; familyName?: string };
  emails?: { value: string }[];
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly users: UsersService;

  constructor(users: UsersService) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      // Пропускаємо реєстрацію стратегії, якщо OAuth не налаштований
      super({
        clientID: 'placeholder',
        clientSecret: 'placeholder',
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ??
          'http://localhost:3000/api/v1/auth/google/callback',
        scope: ['email', 'profile'],
      });
    } else {
      super({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        scope: ['email', 'profile'],
      });
    }
    this.users = users;
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email)
      return done(new Error('Email not provided by Google'), undefined);
    const firstname = profile.name?.givenName ?? profile.displayName ?? 'User';
    const lastname = profile.name?.familyName ?? '';
    const user = await this.users.findOrCreateOAuthUser(
      email,
      'google',
      profile.id,
      { firstname, lastname },
    );
    done(null, { id: user.id, email: user.email });
  }
}
