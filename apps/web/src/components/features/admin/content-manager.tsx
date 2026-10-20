'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApiError } from '@/lib/api/client'
import { updateContent, type SiteContentMap } from '@/services/content'
import { useToast } from '@/components/ui/toast'

export function ContentManager({ initial }: { initial: SiteContentMap }) {
  const { toast } = useToast()
  const router = useRouter()
  const [about, setAbout] = useState(initial.about ?? '')
  const [contacts, setContacts] = useState(initial.contacts ?? '')
  const [busy, setBusy] = useState(false)

  async function save(key: 'about' | 'contacts', value: string) {
    if (busy) return
    setBusy(true)
    try {
      await updateContent(key, value || null)
      toast('Текст оновлено')
      router.refresh()
    } catch (e) {
      toast(authApiError(e) ?? 'Помилка', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="about" className="block text-sm font-medium">Про нас</label>
        <textarea
          id="about"
          rows={5}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-amber-500"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void save('about', about)}
          className="mt-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-espresso hover:bg-amber-400 disabled:opacity-50"
        >
          Зберегти «Про нас»
        </button>
      </div>

      <div>
        <label htmlFor="contacts" className="block text-sm font-medium">Контакти</label>
        <textarea
          id="contacts"
          rows={2}
          value={contacts}
          onChange={(e) => setContacts(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-amber-500"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void save('contacts', contacts)}
          className="mt-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-espresso hover:bg-amber-400 disabled:opacity-50"
        >
          Зберегти контакти
        </button>
      </div>
    </div>
  )
}
