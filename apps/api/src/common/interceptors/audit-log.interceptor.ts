import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @InjectModel('AuditLog') private readonly auditLogModel: Model<any>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user, tenantId } = request;

    // Only audit mutating operations
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logAction({
            tenantId,
            userId: user?.userId,
            action: `${method} ${url}`,
            resource: context.getClass().name,
            resourceId: request.params?.id,
            details: this.sanitizeBody(body),
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            duration: Date.now() - startTime,
            status: 'success',
          });
        },
        error: (error) => {
          this.logAction({
            tenantId,
            userId: user?.userId,
            action: `${method} ${url}`,
            resource: context.getClass().name,
            resourceId: request.params?.id,
            details: this.sanitizeBody(body),
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            duration: Date.now() - startTime,
            status: 'failure',
            errorMessage: error.message,
          });
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;
    const sanitized = { ...body };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken'];
    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  private async logAction(data: any): Promise<void> {
    try {
      await this.auditLogModel.create(data);
    } catch {
      // Silently fail - audit logging should not break the request
    }
  }
}
