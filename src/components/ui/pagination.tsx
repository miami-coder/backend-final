import Link from 'next/link'

export function Pagination({ page, totalPages, hrefFor }: {
  page: number
  totalPages: number
  hrefFor: (p: number) => string
}) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
  return (
    <nav className="flex items-center gap-2" aria-label="Пагінація">
      {page > 1 && <Link className="rounded-lg border px-3 py-1.5 hover:bg-stone-100" href={hrefFor(page - 1)}>Попередня</Link>}
      {pages.map((p) =>
        p === page
          ? <span key={p} aria-current="page" className="rounded-lg bg-brand-500 px-3 py-1.5 text-white">{p}</span>
          : <Link key={p} className="rounded-lg border px-3 py-1.5 hover:bg-stone-100" href={hrefFor(p)}>{p}</Link>,
      )}
      {page < totalPages && <Link className="rounded-lg border px-3 py-1.5 hover:bg-stone-100" href={hrefFor(page + 1)}>Наступна</Link>}
    </nav>
  )
}
