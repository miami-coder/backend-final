import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TokenService } from './jwt.service';

describe('TokenService', () => {
  let service: TokenService;
  let raw: JwtService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxx';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_x';
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [TokenService],
    }).compile();
    service = module.get(TokenService);
    raw = module.get(JwtService);
  });

  it('signs and verifies access token', () => {
    const t = service.signAccess({ sub: 'u1', email: 'a@b.com', roles: ['user'] });
    const payload = service.verifyAccess(t);
    expect(payload.sub).toBe('u1');
    expect(payload.roles).toEqual(['user']);
  });

  it('signs and verifies refresh token', () => {
    const t = service.signRefresh({ sub: 'u1' });
    const payload = service.verifyRefresh(t);
    expect(payload.sub).toBe('u1');
  });

  it('rejects access token signed with wrong secret', () => {
    const t = raw.sign({ sub: 'u1' }, { secret: 'wrong_secret_min_32_chars_xxxxx' });
    expect(() => service.verifyAccess(t)).toThrow();
  });
});
