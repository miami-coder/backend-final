import Link from 'next/link'

// 404 сторінки закладу: спрацьовує на notFound() у page.tsx
// (бекенд віддає 404 для не-approved/неіснуючого закладу)
export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">Заклад не знайдено</h1>
      <p className="mt-2 text-muted">Заклад не знайдено або видалений.</p>
      <Link className="mt-6 inline-block text-amber-500 hover:underline" href="/">
        До каталогу
      </Link>
    </div>
  )
}
