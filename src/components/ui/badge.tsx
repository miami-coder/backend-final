import type { HTMLAttributes } from 'react'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'brand' | 'success' | 'warning'
}

// Мапа класів для тонів бейджа
const toneClasses = {
  neutral: 'border border-line bg-raised text-muted',
  brand: 'bg-amber-500 text-espresso',
  success: 'bg-success/15 text-success',
  warning: 'bg-amber-400/15 text-amber-400',
} satisfies Record<NonNullable<BadgeProps['tone']>, string>

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className ?? ''}`}
      {...props}
    />
  )
}
