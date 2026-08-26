import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PermissionsService } from '../permissions.service';

export const USER_ROLE_ADDED = 'user_role.added';
export const USER_ROLE_REMOVED = 'user_role.removed';

@Injectable()
export class UserRoleListener {
  private readonly logger = new Logger(UserRoleListener.name);

  constructor(private readonly perms: PermissionsService) {}

  @OnEvent(USER_ROLE_ADDED)
  async handleAdded(payload: { userId: string }) {
    this.logger.log(`Invalidating permissions cache for user ${payload.userId} (role added)`);
    await this.perms.invalidate(payload.userId);
  }

  @OnEvent(USER_ROLE_REMOVED)
  async handleRemoved(payload: { userId: string }) {
    this.logger.log(`Invalidating permissions cache for user ${payload.userId} (role removed)`);
    await this.perms.invalidate(payload.userId);
  }
}
