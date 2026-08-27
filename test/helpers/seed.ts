import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export async function createTestUser(
  ds: DataSource,
  data: { email: string; password: string; firstname: string; lastname: string; roles?: string[] },
): Promise<string> {
  const passwordHash = await bcrypt.hash(data.password, 4);
  const user = await ds.query(
    `INSERT INTO "users"("email","passwordHash") VALUES ($1,$2) RETURNING "id"`,
    [data.email, passwordHash],
  );
  const userId = user[0].id;
  await ds.query(
    `INSERT INTO "profiles"("userId","firstname","lastname") VALUES ($1,$2,$3)`,
    [userId, data.firstname, data.lastname],
  );
  for (const code of data.roles ?? ['user']) {
    const role = await ds.query(`SELECT "id" FROM "roles" WHERE "code"=$1`, [code]);
    if (role[0]) {
      await ds.query(`INSERT INTO "user_roles"("userId","roleId") VALUES ($1,$2)`, [userId, role[0].id]);
    }
  }
  return userId;
}
