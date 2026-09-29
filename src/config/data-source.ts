import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { Role } from '../modules/rbac/entities/role.entity';
import { Permission } from '../modules/rbac/entities/permission.entity';
import { RolePermission } from '../modules/rbac/entities/role-permission.entity';
import { UserRole } from '../modules/rbac/entities/user-role.entity';
import { User } from '../modules/users/entities/user.entity';
import { Profile } from '../modules/users/entities/profile.entity';
import { OAuthAccount } from '../modules/users/entities/oauth-account.entity';
import { Init1700000000000 } from '../migrations/1700000000000-Init';
import { Venues1700000001000 } from '../migrations/1700000001000-Venues';
import { Reviews1700000002000 } from '../migrations/1700000002000-Reviews';
import { Venue } from '../modules/venues/entities/venue.entity';
import { VenuePhoto } from '../modules/venues/entities/venue-photo.entity';
import { VenueFeature } from '../modules/venues/entities/venue-feature.entity';
import { VenueFeatureAssignment } from '../modules/venues/entities/venue-feature-assignment.entity';
import { Tag } from '../modules/venues/entities/tag.entity';
import { VenueTag } from '../modules/venues/entities/venue-tag.entity';
import { VenueType } from '../modules/venues/entities/venue-type.entity';
import { VenueTypeAssignment } from '../modules/venues/entities/venue-type-assignment.entity';
import { Review } from '../modules/reviews/entities/review.entity';
import { Favorite } from '../modules/favorites/entities/favorite.entity';
import { Favorites1700000003000 } from '../migrations/1700000003000-Favorites';
import { News } from '../modules/news/entities/news.entity';
import { News1700000004000 } from '../migrations/1700000004000-News';
import { Complaint } from '../modules/complaints/entities/complaint.entity';
import { Complaints1700000005000 } from '../migrations/1700000005000-Complaints';
import { Hangout } from '../modules/hangouts/entities/hangout.entity';
import { HangoutParticipant } from '../modules/hangouts/entities/hangout-participant.entity';
import { Hangouts1700000006000 } from '../migrations/1700000006000-Hangouts';
import { VenueView } from '../modules/analytics/entities/venue-view.entity';
import { AnalyticsEvent } from '../modules/analytics/entities/analytics-event.entity';
import { Analytics1700000007000 } from '../migrations/1700000007000-Analytics';
import { AuditLog } from '../modules/admin/entities/audit-log.entity';
import { Admin1700000008000 } from '../migrations/1700000008000-Admin';
import { Messages1700000009000 } from '../migrations/1700000009000-Messages';

loadEnv();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  // Кредів БД взято лише з .env — без захардкоджених фолбеків
  username: process.env.DATABASE_USER!,
  password: process.env.DATABASE_PASS!,
  database: process.env.DATABASE_NAME!,
  entities: [
    Role,
    Permission,
    RolePermission,
    UserRole,
    User,
    Profile,
    OAuthAccount,
    Venue,
    VenuePhoto,
    VenueFeature,
    VenueFeatureAssignment,
    Tag,
    VenueTag,
    VenueType,
    VenueTypeAssignment,
    Review,
    Favorite,
    News,
    Complaint,
    Hangout,
    HangoutParticipant,
    VenueView,
    AnalyticsEvent,
    AuditLog,
  ],
  migrations: [
    Init1700000000000,
    Venues1700000001000,
    Reviews1700000002000,
    Favorites1700000003000,
    News1700000004000,
    Complaints1700000005000,
    Hangouts1700000006000,
    Analytics1700000007000,
    Admin1700000008000,
    Messages1700000009000,
  ],
  synchronize: false,
});
