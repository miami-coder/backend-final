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

loadEnv();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'piyachok',
  password: process.env.DATABASE_PASS ?? 'piyachok_dev',
  database: process.env.DATABASE_NAME ?? 'piyachok',
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
  ],
  migrations: [
    Init1700000000000,
    Venues1700000001000,
    Reviews1700000002000,
    Favorites1700000003000,
    News1700000004000,
    Complaints1700000005000,
  ],
  synchronize: false,
});
