import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from '@/lib/validation/auth'

describe('loginSchema', () => {
  it('валідний вхід', () => {
    expect(loginSchema.safeParse({ email: 'a@b.c', password: 'x' }).success).toBe(true)
  })
  it('невалідний email', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
  })
})

describe('registerSchema', () => {
  const valid = {
    firstname: 'Олена', lastname: 'Коваль', email: 'a@b.c',
    password: 'Password1', age: 20, acceptEula: true,
  }
  it('валідна реєстрація', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })
  it('пароль без цифри відхиляється', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'PasswordOnly' }).success).toBe(false)
  })
  it('пароль без великої літери відхиляється', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'password1' }).success).toBe(false)
  })
  it('кирилична велика літера не замінює латинську (як на бекенді)', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'Пароль1' }).success).toBe(false)
  })
  it('age < 18 відхиляється', () => {
    expect(registerSchema.safeParse({ ...valid, age: 17 }).success).toBe(false)
  })
  it('acceptEula false відхиляється', () => {
    expect(registerSchema.safeParse({ ...valid, acceptEula: false }).success).toBe(false)
  })
})
