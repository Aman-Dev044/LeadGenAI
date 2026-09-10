import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = undefined;
    let code: string | undefined;
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message || exception.message;
        errors = resp.errors;
        // Machine-readable hints for the client (e.g. EMAIL_NOT_VERIFIED + the email/tenant to verify)
        if (typeof resp.code === 'string') code = resp.code;
        if (resp.details && typeof resp.details === 'object') details = resp.details;

        // Handle class-validator errors
        if (Array.isArray(resp.message)) {
          errors = resp.message;
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
      // Don't expose internal error messages in production
      if (process.env.NODE_ENV === 'production') {
        message = 'Internal server error';
      } else {
        message = exception.message;
      }
    }

    const errorResponse: Record<string, any> = {
      success: false,
      statusCode: status,
      message,
      ...(errors && { errors }),
      ...(code && { code }),
      ...(details && { details }),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}
