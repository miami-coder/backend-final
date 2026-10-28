// Перед прогоном чекаємо готовність docker-стеки: web (:3001) і
// бек (:3000/api/v1/health). Бек після restart стартує не одразу
// (start:dev), без цього перший BFF- логін віддає 502.
const WEB = 'http://localhost:3001'
const API = 'http://localhost:3000/api/v1/health'
const TIMEOUT_MS = 90_000

async function waitFor(url: string, probe: (r: Response) => boolean): Promise<void> {
  const started = Date.now()
  for (;;) {
    try {
      const res = await fetch(url)
      if (probe(res)) return
    } catch {
      // ще не піднято
    }
    if (Date.now() - started > TIMEOUT_MS) {
      throw new Error(`Стека неготова за ${TIMEOUT_MS / 1000}с: ${url}`)
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
}

export default async function globalSetup(): Promise<void> {
  await waitFor(WEB, (r) => r.status === 200)
  await waitFor(API, (r) => r.status === 200)
}