import { Suspense } from 'react'
import { RegisterForm } from './register-form'

export const metadata = { title: 'Реєстрація' }

// Suspense обов'язковий: RegisterForm читає useSearchParams (client hook)
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}
