'use client'

// Обгортка застосунку: поки AgeGate не підтверджено, увесь контент
// недоступний клавіатурі та скрін-рідеру (inert — React 19 підтримує як boolean-проп)
import type { ReactNode } from 'react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { AgeGate, useAgeConfirmed } from '@/components/layout/age-gate'

export function AppShell({ children }: { children: ReactNode }) {
  const confirmed = useAgeConfirmed()
  return (
    <>
      <div inert={!confirmed}>
        <Header />
        <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-6">{children}</main>
        <Footer />
      </div>
      <AgeGate />
    </>
  )
}
