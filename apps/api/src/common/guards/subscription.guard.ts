import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SubscriptionService } from '../../modules/billing/subscription.service';

/**
 * Paths a workspace may still use once its trial or subscription has ended.
 * Everything here exists so somebody can sign in, see what they owe and pay -
 * and nothing else.
 */
const ALLOWED_WHILE_EXPIRED = [
  '/auth',
  '/billing',
  '/tenant',
  '/users/me',
  '/users/profile',
  '/notifications',
  '/health',
  '/account-deletion',
  '/support-tickets',
];

/**
 * The lock on an expired workspace.
 *
 * It does not block the login itself - people must be able to get in to pay.
 * It blocks the product: leads, calls, WhatsApp, settings. The 402 it throws
 * carries `requiresPayment`, which the dashboard turns into a redirect to the
 * billing page.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.role === 'SUPER_ADMIN') return true;

    const tenantId = request.tenantId;
    if (!tenantId || tenantId === 'all') return true;

    const path: string = request.route?.path || request.url || '';
    const withoutPrefix = path.replace(/^\/api\/v\d+/, '');
    if (ALLOWED_WHILE_EXPIRED.some((p) => withoutPrefix === p || withoutPrefix.startsWith(`${p}/`))) return true;

    const state = await this.subscriptions.stateFor(tenantId);
    if (!state || !state.requiresPayment) return true;

    throw new HttpException(
      {
        success: false,
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        requiresPayment: true,
        plan: state.plan,
        trialEnded: state.trial || state.plan === 'trial',
        message: state.plan === 'trial'
          ? 'Your free trial has ended. Choose a plan to carry on.'
          : 'Your subscription has ended. Renew your plan to carry on.',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
