import Link from 'next/link'
import type { SiteContentMap } from '@/services/content'

// Футер — мінімальний (довгий текст «Про нас» живе на /about, вкладка в
// хедері; відгук користувача: блок тексту в футері виглядав перевантажено).
export function Footer({ content }: { content: SiteContentMap | null }) {
  return (
    <footer className="border-t border-line bg-surface">
      <p className="mx-auto max-w-6xl px-4 py-4 text-center text-sm text-faint">
        © 2026 Пиячок · Каталог закладів України · 18+{' '}
        {content?.contacts ? (
          <span className="mx-1">·</span>
        ) : null}
        <Link href="/about" className="hover:text-amber-500 hover:underline">
          Про нас
        </Link>
      </p>
    </footer>
  )
}
