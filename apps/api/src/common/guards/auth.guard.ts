import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PlatformSettingsService } from '../../modules/platform/platform-settings.service';

/** Header a SUPER_ADMIN may send to run a normal tenant-scoped endpoint against another tenant. */
export const TENANT_OVERRIDE_HEADER = 'x-tenant-id';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly platformSettings?: PlatformSettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // Maintenance mode: only the platform owner may keep working
    if (payload.role !== 'SUPER_ADMIN' && this.platformSettings?.isMaintenance()) {
      throw new ServiceUnavailableException(this.platformSettings.maintenanceMessage());
    }

    request.user = {
      _id: payload.sub,
      id: payload.sub,
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role,
      impersonatedBy: payload.impersonatedBy,
      isSuperAdmin: payload.role === 'SUPER_ADMIN',
    };
    request.tenantId = payload.tenantId;

    // Owner may inspect a specific tenant or view platform-wide data across all tenants
    if (payload.role === 'SUPER_ADMIN') {
      const override = request.headers?.[TENANT_OVERRIDE_HEADER];
      if (typeof override === 'string' && /^[a-f0-9]{24}$/i.test(override)) {
        request.tenantId = override;
        request.user.tenantId = override;
        request.tenantOverride = true;
      } else {
        request.tenantId = 'all';
        request.user.tenantId = 'all';
      }
      request.user.isSuperAdmin = true;
    }

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
