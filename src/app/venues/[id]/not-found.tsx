import Link from 'next/link'

// 404 сторінки закладу: спрацьовує на notFound() у page.tsx
// (бекенд віддає 404 для не-approved/неіснуючого закладу)
export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Заклад не знайдено</h1>
      <p className="mt-2 text-stone-500">Заклад не знайдено або видалений.</p>
      <Link className="mt-6 inline-block text-brand-600 hover:underline" href="/">
        До каталогу
      </Link>
    </div>
  )
}
