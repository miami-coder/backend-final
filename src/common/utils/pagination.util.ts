export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  offset: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function normalizePagination(params: PaginationParams): NormalizedPagination {
  const page = Math.max(1, Number(params.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.limit ?? DEFAULT_LIMIT)));
  return { page, limit, offset: (page - 1) * limit };
}

export interface PaginatedResponseMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export function buildMeta(
  pagination: NormalizedPagination,
  total: number,
): PaginatedResponseMeta {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    hasMore: pagination.offset + pagination.limit < total,
  };
}
