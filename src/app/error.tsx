'use client'

// Глобальна межа помилок рендерингу (конвенція файлів Next.js — error.tsx у корені app).
// retry() повторно запитує RSC-пейлоад і лише потім скидає стан межі — на відміну від
// reset(), який рендерить уже отриманий (помилковий) пейлоад і миттєво знову «падає»
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Щось пішло не так</h1>
      <p className="mt-2 text-stone-500">Сервіс тимчасово недоступний. Спробуйте ще раз.</p>
      <button className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600" onClick={retry}>
        Повторити
      </button>
    </div>
  )
}
