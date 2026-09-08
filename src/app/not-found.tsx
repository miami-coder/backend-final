import Link from 'next/link'

// Глобальна 404-сторінка: неспівпадіння маршруту або notFound() у кореневому сегменті
export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-6xl">🍺</p>
      <h1 className="mt-4 text-2xl font-bold">Сторінку не знайдено</h1>
      <p className="mt-2 text-stone-500">Можливо, посилання застаріло або сторінку видалено.</p>
      <Link className="mt-6 inline-block rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600" href="/">
        До каталогу
      </Link>
    </div>
  )
}
