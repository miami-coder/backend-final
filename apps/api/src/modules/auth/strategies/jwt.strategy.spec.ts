import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import * as jwt from 'jsonwebtoken';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const SECRET = 'a'.repeat(40);

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    strategy = new JwtStrategy();
  });

  it('validate returns user from token payload', async () => {
    const user = await strategy.validate({
      sub: 'u1',
      email: 'a@b.com',
      roles: ['user'],
    });
    expect(user.sub).toBe('u1');
    expect(user.roles).toEqual(['user']);
  });

  it('validate defaults roles to []', async () => {
    const user = await strategy.validate({ sub: 'u1' });
    expect(user.roles).toEqual([]);
  });
});

describe('JwtStrategy — видалений юзер', () => {
  const SECRET = 'b'.repeat(40);
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = SECRET;
  });

  it('cache deleted:true → UnauthorizedException + TTL прапора продовжується (sliding 960)', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue(true),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const strategy = new JwtStrategy(cache as any);
    await expect(
      strategy.validate({ sub: 'u-del', email: 'a@b.com', roles: ['user'] }),
    ).rejects.toThrow(UnauthorizedException);
    expect(cache.set).toHaveBeenCalledWith('deleted:u-del', true, 960);
  });

  it('cache miss → користувач проходить', async () => {
    const cache = { get: jest.fn().mockResolvedValue(null) };
    const strategy = new JwtStrategy(cache as any);
    const user = await strategy.validate({
      sub: 'u-ok',
      email: 'a@b.com',
      roles: ['user'],
    });
    expect(user.sub).toBe('u-ok');
  });
});
