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
    const user = await strategy.validate({ sub: 'u1', email: 'a@b.com', roles: ['user'] });
    expect(user.sub).toBe('u1');
    expect(user.roles).toEqual(['user']);
  });

  it('validate defaults roles to []', async () => {
    const user = await strategy.validate({ sub: 'u1' });
    expect(user.roles).toEqual([]);
  });
});
