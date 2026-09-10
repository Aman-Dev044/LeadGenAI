import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SUPER_ADMIN_ONLY_KEY } from '../decorators/super-admin.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const superAdminOnly =
      this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_ONLY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!superAdminOnly && (!requiredRoles || requiredRoles.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // SUPER_ADMIN (platform owner) bypasses all role checks
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Owner-console routes: nobody else, regardless of method
    if (superAdminOnly || (requiredRoles?.length === 1 && requiredRoles[0] === 'SUPER_ADMIN')) {
      throw new ForbiddenException('This area is restricted to the platform owner');
    }

    // VIEWER gets read-only access (GET requests only)
    if (user.role === 'VIEWER') {
      const method = request.method;
      if (method === 'GET') {
        return true;
      }
      throw new ForbiddenException('Viewer role has read-only access');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Role '${user.role}' does not have access. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
