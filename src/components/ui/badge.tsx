import type { HTMLAttributes } from 'react'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'brand' | 'success' | 'warning'
}

// Мапа класів для тонів бейджа
const toneClasses = {
  neutral: 'bg-stone-100 text-stone-600',
  brand: 'bg-brand-100 text-brand-800',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
} satisfies Record<NonNullable<BadgeProps['tone']>, string>

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className ?? ''}`}
      {...props}
    />
  )
}
