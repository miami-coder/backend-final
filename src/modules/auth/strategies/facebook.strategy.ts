import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { UsersService } from '../../users/users.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  private readonly users: UsersService;

  constructor(users: UsersService) {
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
      super({
        clientID: 'placeholder',
        clientSecret: 'placeholder',
        callbackURL:
          process.env.FACEBOOK_CALLBACK_URL ??
          'http://localhost:3000/api/v1/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name', 'displayName'],
      });
    } else {
      super({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL!,
        profileFields: ['id', 'emails', 'name', 'displayName'],
      });
    }
    this.users = users;
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any) => void,
  ) {
    const email =
      profile.emails?.[0]?.value ?? `${profile.id}@facebook.placeholder`;
    const firstname = profile.name?.givenName ?? profile.displayName ?? 'User';
    const lastname = profile.name?.familyName ?? '';
    const user = await this.users.findOrCreateOAuthUser(
      email,
      'facebook',
      profile.id,
      { firstname, lastname },
    );
    done(null, { id: user.id, email: user.email });
  }
}
