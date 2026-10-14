import { Test } from '@nestjs/testing';
import {
  UserRoleListener,
  USER_ROLE_ADDED,
  USER_ROLE_REMOVED,
} from './user-role.listener';
import { PermissionsService } from '../permissions.service';

describe('UserRoleListener', () => {
  let listener: UserRoleListener;
  let perms: { invalidate: jest.Mock };

  beforeEach(async () => {
    perms = { invalidate: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        UserRoleListener,
        { provide: PermissionsService, useValue: perms },
      ],
    }).compile();
    listener = module.get(UserRoleListener);
  });

  it('invalidates cache when role added', async () => {
    await listener.handleAdded({ userId: 'u1' });
    expect(perms.invalidate).toHaveBeenCalledWith('u1');
  });

  it('invalidates cache when role removed', async () => {
    await listener.handleRemoved({ userId: 'u2' });
    expect(perms.invalidate).toHaveBeenCalledWith('u2');
  });

  it('exposes event name constants', () => {
    expect(USER_ROLE_ADDED).toBe('user_role.added');
    expect(USER_ROLE_REMOVED).toBe('user_role.removed');
  });
});
