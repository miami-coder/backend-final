import { buildMeta, normalizePagination } from './pagination.util';

describe('normalizePagination', () => {
  it('returns defaults when empty', () => {
    expect(normalizePagination({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('clamps negative page to 1', () => {
    expect(normalizePagination({ page: -5, limit: 10 }).page).toBe(1);
  });

  it('clamps limit to MAX_LIMIT=100', () => {
    expect(normalizePagination({ limit: 9999 }).limit).toBe(100);
  });

  it('clamps limit to at least 1', () => {
    expect(normalizePagination({ limit: 0 }).limit).toBe(1);
  });

  it('computes offset', () => {
    expect(normalizePagination({ page: 3, limit: 10 })).toEqual({
      page: 3,
      limit: 10,
      offset: 20,
    });
  });
});

describe('buildMeta', () => {
  it('flags hasMore correctly', () => {
    expect(buildMeta({ page: 1, limit: 20, offset: 0 }, 50)).toEqual({
      page: 1,
      limit: 20,
      total: 50,
      hasMore: true,
    });
    expect(buildMeta({ page: 3, limit: 20, offset: 40 }, 50)).toEqual({
      page: 3,
      limit: 20,
      total: 50,
      hasMore: false,
    });
  });
});
