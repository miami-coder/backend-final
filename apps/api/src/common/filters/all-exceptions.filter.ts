import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (typeof resp === 'object' && resp !== null) {
        const r = resp as { message?: string | string[]; error?: string };
        message = Array.isArray(r.message)
          ? r.message.join('; ')
          : (r.message ?? message);
        code = r.error ?? this.codeFromStatus(status);
      }
      code = this.codeFromStatus(status);
    } else if (exception instanceof Error) {
      // Невалідний UUID у URL/запиті — не помилка сервера (ревʼю крок 3):
      // PG повертає 22P02, віддаємо 400 замість 500.
      if ((exception as { code?: string }).code === '22P02') {
        status = HttpStatus.BAD_REQUEST;
        code = 'BAD_REQUEST';
        message = 'Некоректний ідентифікатор';
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    } else {
      this.logger.error('Unknown exception', String(exception));
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${code} ${message}`,
      );
    }

    const body: ErrorResponse = { error: { code, message, details } };
    response.status(status).json(body);
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
    };
    return map[status] ?? 'INTERNAL_ERROR';
  }
}
