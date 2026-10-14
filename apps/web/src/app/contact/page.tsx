import { ContactForm } from '@/components/features/contact/contact-form'

export const metadata = { title: 'Написати нам — Пиячок' }

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl py-8">
      <h1 className="font-display text-2xl font-bold text-ink">Написати нам</h1>
      <p className="mb-6 mt-2 text-sm text-muted">
        Питання, пропозиція чи проблема з закладом — напишіть команді «Пиячок».
      </p>
      <ContactForm />
    </div>
  )
}