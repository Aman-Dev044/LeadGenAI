import { SetMetadata } from '@nestjs/common';

export const SUPER_ADMIN_ONLY_KEY = 'superAdminOnly';

/**
 * Restricts a controller/handler to the platform owner (SUPER_ADMIN). Unlike @Roles(),
 * no other role - not even VIEWER's read-only bypass - can get through.
 */
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_ONLY_KEY, true);
