import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination-meta.dto';

/**
 * Документує успішну відповідь у формі `{ data: T }`.
 * Для ендпоінтів, що загортають один об'єкт у поле `data`.
 */
export function ApiDataResponse(opts: {
  status?: number;
  description?: string;
  type: Type<unknown>;
}) {
  const response = opts.status === 201 ? ApiCreatedResponse : ApiOkResponse;
  return applyDecorators(
    ApiExtraModels(opts.type),
    response({
      description: opts.description,
      schema: {
        type: 'object',
        properties: { data: { $ref: getSchemaPath(opts.type) } },
      },
    }),
  );
}

/**
 * Документує успішну відповідь у формі `{ data: T[] }` (масив, без meta).
 * Для ендпоінтів, що повертають непагінований список, загорнутий у `data`.
 */
export function ApiDataArrayResponse(opts: {
  status?: number;
  description?: string;
  type: Type<unknown>;
}) {
  const response = opts.status === 201 ? ApiCreatedResponse : ApiOkResponse;
  return applyDecorators(
    ApiExtraModels(opts.type),
    response({
      description: opts.description,
      schema: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(opts.type) } },
        },
      },
    }),
  );
}

/**
 * Документує успішну відповідь у формі `{ data: T[], meta: PaginationMetaDto }`.
 * Для ендпоінтів, що повертають paginated-список.
 */
export function ApiPaginatedResponse(opts: {
  status?: number;
  description?: string;
  type: Type<unknown>;
}) {
  return applyDecorators(
    ApiExtraModels(opts.type, PaginationMetaDto),
    ApiOkResponse({
      description: opts.description,
      schema: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(opts.type) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
}

/**
 * Документує мінімальну відповідь-підтвердження у формі `{ data: { id } }`.
 */
export function ApiIdResponse(opts: { status?: number; description?: string }) {
  const response = opts.status === 201 ? ApiCreatedResponse : ApiOkResponse;
  return applyDecorators(
    response({
      description: opts.description,
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: { id: { type: 'string', format: 'uuid' } },
          },
        },
      },
    }),
  );
}
