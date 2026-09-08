export type Role = 'user' | 'venue_admin' | 'super_admin' | 'critic'

export interface SessionUser {
  id: string
  email: string
  roles: Role[]
}

export interface Profile {
  firstname: string | null
  lastname: string | null
  phone: string | null
  age: number | null
  avatarUrl: string | null
}
