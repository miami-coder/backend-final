import { Skeleton } from '@/components/ui/skeleton'

// Скелетон сторінки закладу (замість сирого animate-pulse — резидуал 12)
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-10 w-44 rounded-lg" />
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
