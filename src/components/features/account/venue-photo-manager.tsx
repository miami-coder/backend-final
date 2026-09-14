'use client'

// Менеджер фото закладу (вкладка «Фото»): multipart POST /venues/:id/photos
// (поле file; content-type НЕ ставимо — браузер сам проставить boundary
// для FormData) → toast + router.refresh() (перезавантажує серверні дані
// вкладки). Список — lazy-зображення з venue.photos.
//
// Відхилення від референс-імплементації брифа (тести брифа — вербатим,
// саме вони поведінкова специфіка): (1) upload запускається одразу на
// вибір файлу (change), кнопка лишається як ручний ретрай після помилки;
// (2) img з осмисленим alt — з alt="" елемент випадає з a11y-дерева
// (role presentation), і getByRole('img') у тесті його не знаходить.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import type { VenuePhoto } from '@/types/venue'

export function VenuePhotoManager({ venueId, photos }: { venueId: string; photos: VenuePhoto[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function upload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api(`/venues/${venueId}/photos`, { method: 'POST', body: fd })
      toast('Фото завантажено')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не вдалося завантажити фото', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section aria-label="Фото закладу">
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Додати фото"
          className="text-sm"
          onChange={upload}
          disabled={uploading}
        />
        <Button size="sm" onClick={upload} disabled={uploading}>
          {uploading ? 'Завантажуємо…' : 'Завантажити'}
        </Button>
      </div>
      <p className="mt-2 text-sm text-stone-500">
        Увага: завантажене фото може не з&apos;явитись у публічній галереї автоматично (обмеження бекенда).
      </p>
      {photos.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">Фото ще немає.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */}
              <img src={p.url} alt={`Фото закладу ${i + 1}`} loading="lazy" className="h-40 w-full object-cover" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
