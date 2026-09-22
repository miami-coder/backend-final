'use client'

import type { TextareaHTMLAttributes } from 'react'

// Патерн Input (src/components/ui/input.tsx), лише тег <textarea>
// і висота під багаторядковий текст відгуку
const textareaClasses =
  'w-full min-h-24 rounded-xl border border-strong bg-bg px-3 py-2 text-ink placeholder:text-faint focus:border-amber-500 focus:outline-none'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={className ? `${textareaClasses} ${className}` : textareaClasses} {...props} />
}
