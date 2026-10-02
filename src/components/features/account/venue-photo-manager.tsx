'use client'

// Менеджер фото закладу (вкладка «Фото»): multipart POST /venues/:id/photos
// (поле file; content-type НЕ ставимо — браузер сам проставить boundary
// для FormData) → toast + router.refresh() (перезавантажує серверні дані
// вкладки). Список — lazy-зображення з venue.photos. Бекенд приєднує фото
// (VenuePhoto + mainPhotoUrl для першого), тож воно одразу у галереї.
//
// Відхилення від референс-імплементації брифа (тести брифа — вербатим,
// саме вони поведінкова специфіка): (1) upload запускається одразу на
// вибір файлу (change); (2) img з осмисленим alt — з alt="" елемент
// випадає з a11y-дерева (role presentation), і getByRole('img') у тесті
// його не знаходить. Пікер — FilePickerButton: клікабельна/hover-активна
// тільки кнопка, а не рядок «Choose File / No file chosen».

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FilePickerButton } from '@/components/ui/file-picker-button'
import { useToast } from '@/components/ui/toast'
import { uploadVenuePhoto } from '@/services/venues'
import { ApiError } from '@/lib/api/parse'
import type { VenuePhoto } from '@/types/venue'

export function VenuePhotoManager({ venueId, photos }: { venueId: string; photos: VenuePhoto[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)

  async function upload(file: File) {
    setUploading(true)
    try {
      await uploadVenuePhoto(venueId, file)
      toast('Фото завантажено')
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
        <FilePickerButton
          buttonLabel={uploading ? 'Завантажуємо…' : 'Додати фото'}
          inputLabel="Додати фото"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onFiles={(files) => {
            if (files[0]) void upload(files[0])
          }}
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        Перше завантажене фото стає головним у публічній галереї.
      </p>
      {photos.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Фото ще немає.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */}
              <img src={p.url} alt={`Фото закладу ${i + 1}`} loading="lazy" className="h-40 w-full object-cover" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}