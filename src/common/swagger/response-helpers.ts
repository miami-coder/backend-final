import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination-meta.dto';

/**
 * Documents a success response of shape `{ data: T }`.
 * Use for endpoints that wrap a single entity in a `data` field.
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
 * Documents a success response of shape `{ data: T[] }` (array, no meta).
 * Use for endpoints that return a non-paginated list wrapped in `data`.
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
 * Documents a success response of shape `{ data: T[], meta: PaginationMetaDto }`.
 * Use for endpoints that return a paginated list.
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
 * Documents a minimal `{ data: { id } }` acknowledgement response.
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
