import { Controller, Delete, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { GoogleCalendarService } from './google-calendar.service';
import { CurrentTenant, CurrentUser, Public, Roles } from '../../common/decorators';

const TEAM = ['ADMIN', 'SALES_MANAGER', 'SALESPERSON'] as const;

/**
 * Connect a salesperson's Google Calendar.
 *   GET  /calendar/status           - this user's connection (+ team overview for managers)
 *   GET  /calendar/google/connect   - { url } to send the browser to
 *   GET  /calendar/google/callback  - Google redirects here (public), then back to the dashboard
 *   DELETE /calendar/google         - disconnect
 */
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly google: GoogleCalendarService,
    private readonly configService: ConfigService,
  ) {}

  @Get('status')
  @Roles(...TEAM, 'VIEWER')
  status(@CurrentTenant() tenantId: string, @CurrentUser() user: { userId: string; role: string }) {
    const includeTeam = ['ADMIN', 'SALES_MANAGER'].includes(user.role);
    return this.google.status(tenantId, user.userId, includeTeam);
  }

  @Get('google/connect')
  @Roles(...TEAM)
  async connect(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Query('returnTo') returnTo?: string,
  ) {
    const safeReturn = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard/appointments';
    return { url: await this.google.authUrl(tenantId, user.userId, safeReturn) };
  }

  @Get('google/callback')
  @Public()
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res: Response) {
    const app = (this.configService.get<string>('app.url') || 'http://localhost:3000').replace(/\/+$/, '');
    let target = '/dashboard/appointments';
    try {
      if (error) throw new Error(error === 'access_denied' ? 'You cancelled the Google sign-in' : error);
      if (!code) throw new Error('Missing authorisation code');
      const result = await this.google.handleCallback(code, state);
      if (result.returnTo && result.returnTo.startsWith('/')) target = result.returnTo;
      const q = new URLSearchParams({ calendar: 'connected', email: result.email || '' });
      return res.redirect(`${app}${target}?${q.toString()}`);
    } catch (err: any) {
      const q = new URLSearchParams({ calendar: 'error', message: String(err?.message || 'Could not connect Google Calendar').slice(0, 200) });
      return res.redirect(`${app}${target}?${q.toString()}`);
    }
  }

  @Delete('google')
  @Roles(...TEAM)
  async disconnect(@CurrentTenant() tenantId: string, @CurrentUser() user: { userId: string }) {
    const removed = await this.google.disconnect(tenantId, user.userId);
    return { disconnected: removed };
  }
}
