import type { SiteContentMap } from '@/services/content'

// «Про нас» і контакти — з редагованих супер-адміном текстів (GET /content).
// Фетч робить серверний root-layout і передає пропами: AppShell — клієнтський,
// async-феч у синхронному клієнтовому дереві не працює (revʼю сам знайшов).
export function Footer({ content }: { content: SiteContentMap | null }) {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {content?.about && (
          <div>
            <h2 className="font-display text-sm font-semibold text-ink">Про нас</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{content.about}</p>
          </div>
        )}
        {content?.contacts && <p className="text-sm text-muted">{content.contacts}</p>}
        {!content?.about && !content?.contacts && (
          <p className="text-center text-sm text-faint">
            © 2026 Пиячок · Каталог закладів України · 18+
          </p>
        )}
      </div>
    </footer>
  )
}
