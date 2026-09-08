import type { PaginatedMeta } from '@/types/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } }
    if (body.error?.code) {
      return new ApiError(res.status, body.error.code, body.error.message ?? 'Помилка запиту', body.error.details ?? null)
    }
  } catch {
    // не-JSON тіло
  }
  return new ApiError(res.status, 'INTERNAL_ERROR', 'Сервіс тимчасово недоступний')
}

export async function parseData<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorFromResponse(res)
  const body = (await res.json()) as { data?: T }
  // Тіло вже прочитане вище — errorFromResponse знову робив би res.json()
  // на вичерпаному стрімі (TypeError), тому конструюємо помилку напряму
  if (!('data' in body)) {
    throw new ApiError(res.status, 'INTERNAL_ERROR', 'Сервіс тимчасово недоступний')
  }
  return body.data as T
}

export async function parseList<T>(res: Response): Promise<{ data: T[]; meta?: PaginatedMeta }> {
  if (!res.ok) throw await errorFromResponse(res)
  return (await res.json()) as { data: T[]; meta?: PaginatedMeta }
}

export async function parseRaw<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorFromResponse(res)
  return (await res.json()) as T
}
