import type { VenuePhoto } from '@/types/venue'

// Галерея закладу: головне фото + решта (максимум 8 мініатюр у сітці 4 колонки).
// Фото URL — абсолютні з бекенда (mainPhotoUrl/photos[].url); порожній список →
// плейсхолдер «Немає фото».
export function PhotoGallery({ mainPhotoUrl, photos }: { mainPhotoUrl: string | null; photos: VenuePhoto[] }) {
  const urls = [mainPhotoUrl, ...photos.map((p) => p.url)].filter((u): u is string => Boolean(u))
  if (urls.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
        Немає фото
      </div>
    )
  }
  const [first, ...rest] = urls
  return (
    <div className="space-y-2">
      {/* Зовнішні URL з бекенда (rewrite /static/* у next.config), не оптимізуємо */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={first} alt="" loading="lazy" className="h-64 w-full rounded-xl object-cover" />
      {rest.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {rest.slice(0, 8).map((url, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={url + i} src={url} alt="" loading="lazy" className="h-20 w-full rounded-lg object-cover" />
          ))}
        </div>
      )}
    </div>
  )
}
