'use client'

import type { TextareaHTMLAttributes } from 'react'

// Патерн Input (src/components/ui/input.tsx), лише тег <textarea>
// і висота під багаторядковий текст відгуку
const textareaClasses =
  'w-full min-h-24 rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-500 focus:outline-none'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={className ? `${textareaClasses} ${className}` : textareaClasses} {...props} />
}
