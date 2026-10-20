import { ContentManager } from '@/components/features/admin/content-manager'
import { getSiteContent } from '@/services/content.server'

export const revalidate = 0

export const metadata = { title: 'Тексти сайту — Адмінка' }

export default async function AdminContentPage() {
  const content = await getSiteContent().catch(() => ({
    about: null,
    contacts: null,
  }))

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold">Загальні тексти</h1>
      <p className="mt-1 text-sm text-muted">
        Редакційні розділи сайту — редагує супер-адмін (revʼю викладача).
      </p>
      <div className="mt-6">
        <ContentManager initial={content} />
      </div>
    </main>
  )
}