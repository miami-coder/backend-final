'use client'

import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

// Мапа класів для варіантів кнопки
const variantClasses = {
  primary: 'bg-amber-500 text-espresso hover:bg-amber-400 active:bg-amber-600',
  secondary: 'border border-strong bg-surface text-ink hover:bg-raised hover:border-amber-500/60',
  ghost: 'text-amber-400 hover:bg-raised',
  danger: 'bg-danger text-espresso hover:bg-danger/85',
} satisfies Record<NonNullable<ButtonProps['variant']>, string>

const sizeClasses = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2',
} satisfies Record<NonNullable<ButtonProps['size']>, string>

// За замовчуванням type="button", щоб кнопка всередині <form> ненавмисно не сабмітнула його;
// явний type="submit" у пропсах усе одно перезаписує дефолт
export function Button({ variant = 'primary', size = 'md', type = 'button', className, ...props }: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={classes} {...props} />
}
