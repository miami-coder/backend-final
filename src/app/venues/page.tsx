import { redirect } from 'next/navigation'

// /venues?q=… — зручний псевдонім каталогу (спека §5: пошук → /venues?q=):
// сам каталог живе на /, тут лише перенаправляємо зі збереженням параметрів
export default async function VenuesAliasPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string' && value !== '') qs.set(key, value)
    else if (Array.isArray(value)) for (const v of value) qs.append(key, v)
  }
  redirect(qs.size > 0 ? `/?${qs.toString()}` : '/')
}
