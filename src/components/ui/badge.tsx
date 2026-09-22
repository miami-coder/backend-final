import type { HTMLAttributes } from 'react'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'brand' | 'success' | 'warning'
}

// Мапа класів для тонів бейджа — обведені варіанти (текст кольоровий, фон прозорий)
const toneClasses = {
  neutral: 'border border-line text-muted',
  brand: 'border border-amber-500 text-amber-400',
  success: 'border border-success/50 text-success',
  warning: 'border border-amber-400/50 text-amber-400',
} satisfies Record<NonNullable<BadgeProps['tone']>, string>

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className ?? ''}`}
      {...props}
    />
  )
}
