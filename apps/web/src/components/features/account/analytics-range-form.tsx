'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AnalyticsRangeForm({ from, to }: { from: string; to: string }) {
  const router = useRouter()
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)

  function apply(e: React.FormEvent) {
    e.preventDefault()
    if (!f || !t || f > t) return
    router.push(`?tab=analytics&from=${f}&to=${t}`)
  }

  return (
    <form onSubmit={apply} className="flex items-end gap-2" aria-label="Період аналітики">
      <label className="block text-sm">З
        <Input type="date" value={f} onChange={(e) => setF(e.target.value)} className="mt-0.5 block" />
      </label>
      <label className="block text-sm">По
        <Input type="date" value={t} onChange={(e) => setT(e.target.value)} className="mt-0.5 block" />
      </label>
      <Button variant="secondary" size="sm" type="submit">Оновити</Button>
    </form>
  )
}
