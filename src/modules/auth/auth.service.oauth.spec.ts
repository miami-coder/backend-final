import { OAuthHandlerService } from './auth.service.oauth';

describe('OAuthHandlerService', () => {
  let auth: any;
  let service: OAuthHandlerService;

  beforeEach(() => {
    auth = {
      getRolesForUser: jest.fn(),
      issueTokensForUser: jest.fn(),
    };
    service = new OAuthHandlerService(auth);
  });

  afterEach(() => {
    delete process.env.FRONTEND_URL;
  });

  it('builds redirect URL with issued tokens', async () => {
    auth.getRolesForUser.mockResolvedValue(['user', 'admin']);
    auth.issueTokensForUser.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      user: { id: 'u1', email: 'a@b.com', roles: ['user', 'admin'] },
    });

    const url = await service.buildRedirectUrl({ id: 'u1', email: 'a@b.com' });

    expect(auth.getRolesForUser).toHaveBeenCalledWith('u1');
    expect(auth.issueTokensForUser).toHaveBeenCalledWith('u1', 'a@b.com', [
      'user',
      'admin',
    ]);
    expect(url).toBe(
      'http://localhost:3001/auth/callback?access=AT&refresh=RT',
    );
  });

  it('uses FRONTEND_URL env when set', async () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    auth.getRolesForUser.mockResolvedValue([]);
    auth.issueTokensForUser.mockResolvedValue({
      accessToken: 'A',
      refreshToken: 'R',
      user: { id: 'u2', email: 'c@d.com', roles: [] },
    });

    const url = await service.buildRedirectUrl({ id: 'u2', email: 'c@d.com' });

    expect(url).toBe(
      'https://app.example.com/auth/callback?access=A&refresh=R',
    );
  });
});
