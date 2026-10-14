// Скелетон каталогу на час завантаження даних

export default function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-xl bg-raised" />
      ))}
    </div>
  )
}
