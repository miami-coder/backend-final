import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { OAuthHandlerService } from './auth.service.oauth';
import { UsersService } from '../users/users.service';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };
  let oauth: { buildRedirectUrl: jest.Mock };
  let users: { getProfile: jest.Mock };

  beforeEach(async () => {
    auth = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };
    oauth = { buildRedirectUrl: jest.fn() };
    users = { getProfile: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: OAuthHandlerService, useValue: oauth },
        { provide: UsersService, useValue: users },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AuthController);
  });

  it('register delegates to AuthService', async () => {
    auth.register.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u1' },
    });
    const res = await controller.register({
      email: 'a@b.com',
      password: 'Password1',
      firstname: 'A',
      lastname: 'B',
      acceptEula: true,
    });
    expect(res.accessToken).toBe('a');
  });

  it('login delegates to AuthService', async () => {
    auth.login.mockResolvedValue({ accessToken: 'a' });
    const res = await controller.login({
      email: 'a@b.com',
      password: 'x',
    });
    expect(res.accessToken).toBe('a');
  });

  it('refresh delegates to AuthService', async () => {
    auth.refresh.mockResolvedValue({ accessToken: 'a2' });
    const res = await controller.refresh('old');
    expect(res.accessToken).toBe('a2');
  });

  it('me повертає profile з іменем (для шапки без пошти)', async () => {
    users.getProfile.mockResolvedValue({ firstname: 'Супер', lastname: 'Адмін' });
    const res = await controller.me({ sub: 'u1', email: 'a@b.com', roles: ['user'] });
    expect(users.getProfile).toHaveBeenCalledWith('u1');
    expect(res.data.profile).toEqual({ firstname: 'Супер', lastname: 'Адмін' });
  });

  it('me без профиля (OAuth-крайовий випадок) → profile null, без кидка', async () => {
    users.getProfile.mockResolvedValue(null);
    const res = await controller.me({ sub: 'u1', email: 'a@b.com', roles: ['user'] });
    expect(res.data.profile).toBeNull();
    expect(res.data.id).toBe('u1');
  });
});
