import Link from 'next/link'

export function Pagination({ page, totalPages, hrefFor, scroll }: {
  page: number
  totalPages: number
  hrefFor: (p: number) => string
  /** false — заміна вмісту без автоскролу вгору (вкладені списки, напр. відгуки) */
  scroll?: boolean
}) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Пагінація">
      {page > 1 && <Link scroll={scroll} className="rounded-full border border-strong px-3 py-1.5 hover:bg-raised hover:border-amber-500/60" href={hrefFor(page - 1)}>Попередня</Link>}
      {pages.map((p) =>
        p === page
          ? <span key={p} aria-current="page" className="rounded-full bg-amber-500 px-3 py-1.5 font-semibold text-espresso">{p}</span>
          : <Link key={p} scroll={scroll} className="rounded-full border border-strong px-3 py-1.5 hover:bg-raised hover:border-amber-500/60" href={hrefFor(p)}>{p}</Link>,
      )}
      {page < totalPages && <Link scroll={scroll} className="rounded-full border border-strong px-3 py-1.5 hover:bg-raised hover:border-amber-500/60" href={hrefFor(page + 1)}>Наступна</Link>}
    </nav>
  )
}
