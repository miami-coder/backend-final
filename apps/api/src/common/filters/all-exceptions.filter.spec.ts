import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost(): ArgumentsHost {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/x' }),
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    host = makeHost();
  });

  it('formats HttpException with string response', () => {
    filter.catch(new NotFoundException('Not found'), host);
    const statusMock = host.switchToHttp().getResponse()
      .status as unknown as jest.Mock;
    const call = statusMock.mock.results[0].value.json.mock.calls[0][0];
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(call.error.code).toBe('NOT_FOUND');
    expect(call.error.message).toBe('Not found');
  });

  it('formats BadRequest with array of messages', () => {
    filter.catch(
      new BadRequestException({
        message: ['email invalid', 'password short'],
        error: 'Bad Request',
      }),
      host,
    );
    const statusMock = host.switchToHttp().getResponse()
      .status as unknown as jest.Mock;
    const call = statusMock.mock.results[0].value.json.mock.calls[0][0];
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(call.error.message).toBe('email invalid; password short');
    expect(call.error.code).toBe('BAD_REQUEST');
  });

  it('handles unknown errors with 500', () => {
    filter.catch(new Error('boom'), host);
    const statusMock = host.switchToHttp().getResponse()
      .status as unknown as jest.Mock;
    expect(statusMock).toHaveBeenCalledWith(500);
  });
});

describe('AllExceptionsFilter — невалідний UUID (ревʼю крок 3)', () => {
  it('PG 22P02 (invalid input syntax for uuid) → 400, не 500', () => {
    const json = jest.fn();
    const filter = new AllExceptionsFilter();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: jest.fn().mockReturnValue({ json }) }),
        getRequest: () => ({ method: 'GET', url: '/x' }),
      }),
    } as unknown as ArgumentsHost;
    const err = new Error(
      'invalid input syntax for type uuid: "abc"',
    ) as Error & { code?: string };
    err.code = '22P02';
    filter.catch(err, host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'BAD_REQUEST' }),
      }),
    );
  });

  it('звичайна Error без коду — 500 як раніше', () => {
    const json = jest.fn();
    const filter = new AllExceptionsFilter();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: jest.fn().mockReturnValue({ json }) }),
        getRequest: () => ({ method: 'GET', url: '/x' }),
      }),
    } as unknown as ArgumentsHost;
    filter.catch(new Error('boom'), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      }),
    );
  });
});
