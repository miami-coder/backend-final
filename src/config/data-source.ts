import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { Role } from '../modules/rbac/entities/role.entity';
import { Permission } from '../modules/rbac/entities/permission.entity';
import { RolePermission } from '../modules/rbac/entities/role-permission.entity';
import { UserRole } from '../modules/rbac/entities/user-role.entity';
import { User } from '../modules/users/entities/user.entity';
import { Init1700000000000 } from '../migrations/1700000000000-Init';

loadEnv();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'piyachok',
  password: process.env.DATABASE_PASS ?? 'piyachok_dev',
  database: process.env.DATABASE_NAME ?? 'piyachok',
  entities: [Role, Permission, RolePermission, UserRole, User],
  migrations: [Init1700000000000],
  synchronize: false,
});
