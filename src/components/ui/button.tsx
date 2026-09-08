'use client'

import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

// Мапа класів для варіантів кнопки
const variantClasses = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600',
  secondary: 'border border-stone-300 bg-white text-ink hover:bg-stone-100',
  ghost: 'text-ink hover:bg-stone-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
} satisfies Record<NonNullable<ButtonProps['variant']>, string>

const sizeClasses = {
  sm: 'px-2.5 py-1 text-sm',
  md: 'px-4 py-2',
} satisfies Record<NonNullable<ButtonProps['size']>, string>

// За замовчуванням type="button", щоб кнопка всередині <form> ненавмисно не сабмітнула його;
// явний type="submit" у пропсах усе одно перезаписує дефолт
export function Button({ variant = 'primary', size = 'md', type = 'button', className, ...props }: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={classes} {...props} />
}
