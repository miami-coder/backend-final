import 'server-only'
import { parseData, parseList } from '@/lib/api/parse'
import type { PaginatedMeta } from '@/types/api'
import type { SessionTokens } from '@/lib/auth/session'

export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

interface ServerFetchOpts {
  tokens?: SessionTokens | null
  revalidate?: number
  init?: RequestInit
}

async function backendFetch(path: string, opts: ServerFetchOpts = {}) {
  const headers = new Headers(opts.init?.headers)
  if (opts.tokens?.accessToken) headers.set('Authorization', `Bearer ${opts.tokens.accessToken}`)
  if (opts.init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const cacheOpts =
    opts.revalidate === 0
      ? { cache: 'no-store' as const } // динамічний запит (кабінетні сторінки)
      : opts.revalidate !== undefined
        ? { next: { revalidate: opts.revalidate } }
        : {}
  return fetch(`${BACKEND_URL}/api/v1${path}`, { ...opts.init, headers, ...cacheOpts })
}

export async function serverFetch<T>(path: string, opts?: ServerFetchOpts): Promise<T> {
  const res = await backendFetch(path, opts)
  return parseData<T>(res)
}

export async function serverFetchList<T>(
  path: string,
  opts?: ServerFetchOpts,
): Promise<{ data: T[]; meta?: PaginatedMeta }> {
  const res = await backendFetch(path, opts)
  return parseList<T>(res)
}
