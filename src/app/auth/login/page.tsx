import { Suspense } from 'react'
import { LoginForm } from './login-form'

export const metadata = { title: 'Вхід' }

// Suspense обов'язковий: LoginForm читає useSearchParams (client hook)
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
