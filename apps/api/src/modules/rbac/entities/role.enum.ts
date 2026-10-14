export enum RoleCode {
  User = 'user',
  VenueAdmin = 'venue_admin',
  SuperAdmin = 'super_admin',
  Critic = 'critic',
}

export const ALL_PERMISSIONS = [
  'venue:create',
  'venue:edit:own',
  'venue:edit:any',
  'venue:moderate',
  'review:create',
  'review:edit:own',
  'review:edit:any',
  'review:feature',
  'hangout:create',
  'news:manage:own',
  'news:manage:any',
  'complaint:manage',
  'user:manage',
  'analytics:view:own',
  'analytics:view:all',
] as const;

export type PermissionCode = (typeof ALL_PERMISSIONS)[number];
