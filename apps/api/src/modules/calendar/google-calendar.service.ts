import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { CredentialsService } from '../credentials/credentials.service';
import { decryptSecret, encryptSecret } from '../../common/utils/crypto.util';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';
const CAL = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'openid',
  'email',
].join(' ');

export interface BusyInterval {
  start: Date;
  end: Date;
  title?: string;
  eventId?: string;
}

/**
 * Google Calendar for the sales team: every appointment (booked by the AI on a
 * call, from the dashboard or by a visitor in the widget) is mirrored into the
 * assigned salesperson's calendar with a Google Meet link, and the booking
 * paths ask the calendar whether a slot is really free before confirming.
 *
 * Plain fetch against the REST API - no SDK. Tokens: the refresh token is
 * encrypted at rest; the access token is refreshed a minute before it expires.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    @InjectModel('CalendarConnection') private readonly connections: Model<any>,
    @InjectModel('Appointment') private readonly appointmentModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    private readonly configService: ConfigService,
    private readonly credentials: CredentialsService,
  ) {}

  // ─── OAuth client ─────────────────────────────────────────────────

  redirectUri(): string {
    const own = this.configService.get<string>('google.redirectUri');
    if (own) return own;
    const base = (this.configService.get<string>('app.publicApiUrl') || 'http://localhost:4000').replace(/\/+$/, '');
    const prefix = (this.configService.get<string>('app.prefix') || '/api/v1').replace(/\/+$/, '');
    return `${base}${prefix}/calendar/google/callback`;
  }

  private async clientFor(tenantId: string) {
    const own = await this.credentials.resolve(tenantId, 'google').catch(() => ({} as Record<string, string>));
    return {
      clientId: own.clientId || this.configService.get<string>('google.clientId') || '',
      clientSecret: own.clientSecret || this.configService.get<string>('google.clientSecret') || '',
      redirectUri: this.redirectUri(),
    };
  }

  async isConfigured(tenantId: string): Promise<boolean> {
    const c = await this.clientFor(tenantId);
    return !!(c.clientId && c.clientSecret);
  }

  // ─── State (signed, so the callback cannot be forged) ─────────────

  private stateSecret(): string {
    return this.configService.get<string>('jwt.accessSecret') || 'dev-access-secret';
  }

  private signState(payload: Record<string, any>): string {
    const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
    const sig = createHmac('sha256', this.stateSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string): { tenantId: string; userId: string; returnTo?: string } {
    const [body, sig] = String(state || '').split('.');
    if (!body || !sig) throw new BadRequestException('Invalid state');
    const expected = createHmac('sha256', this.stateSecret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException('Invalid state');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.tenantId || !payload.userId) throw new BadRequestException('Invalid state');
    if (Date.now() - (payload.iat || 0) > 15 * 60_000) throw new BadRequestException('The connect link expired - try again');
    return payload;
  }

  // ─── Connect / disconnect ─────────────────────────────────────────

  async authUrl(tenantId: string, userId: string, returnTo?: string): Promise<string> {
    const client = await this.clientFor(tenantId);
    if (!client.clientId || !client.clientSecret) {
      throw new BadRequestException('Google Calendar is not configured. Add the OAuth client under Settings > API Credentials > Google Calendar.');
    }
    const params = new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: client.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: this.signState({ tenantId, userId, returnTo }),
    });
    return `${GOOGLE_AUTH}?${params.toString()}`;
  }

  /** Exchanges the code, stores the connection, returns where to send the browser. */
  async handleCallback(code: string, state: string): Promise<{ tenantId: string; userId: string; email: string; returnTo?: string }> {
    const { tenantId, userId, returnTo } = this.verifyState(state);
    const client = await this.clientFor(tenantId);

    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: client.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const token: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !token.access_token) {
      throw new BadRequestException(`Google did not accept the sign-in: ${token.error_description || token.error || tokenRes.status}`);
    }

    let email = '';
    try {
      const info: any = await fetch(GOOGLE_USERINFO, { headers: { Authorization: `Bearer ${token.access_token}` } }).then((r) => r.json());
      email = info?.email || '';
    } catch {
      /* e-mail is cosmetic */
    }

    const existing = await this.connections.findOne({ tenantId, userId, provider: 'google' });
    const refreshEnc = token.refresh_token
      ? encryptSecret(token.refresh_token, this.encryptionKey())
      : existing?.refreshTokenEnc;
    if (!refreshEnc) {
      throw new BadRequestException('Google did not return a refresh token. Remove the app under myaccount.google.com/permissions and connect again.');
    }

    await this.connections.updateOne(
      { tenantId, userId, provider: 'google' },
      {
        $set: {
          email,
          calendarId: existing?.calendarId || 'primary',
          refreshTokenEnc: refreshEnc,
          accessToken: token.access_token,
          accessTokenExpiresAt: new Date(Date.now() + Math.max(60, Number(token.expires_in) || 3600) * 1000),
          scope: token.scope || SCOPES,
          lastError: undefined,
        },
      },
      { upsert: true },
    );
    this.logger.log(`Google Calendar connected for user ${userId} (${email || 'unknown e-mail'})`);
    return { tenantId, userId, email, returnTo };
  }

  async disconnect(tenantId: string, userId: string): Promise<boolean> {
    const conn = await this.connections.findOne({ tenantId, userId, provider: 'google' });
    if (!conn) return false;
    const refresh = conn.refreshTokenEnc ? decryptSecret(conn.refreshTokenEnc, this.encryptionKey()) : null;
    const tokenToRevoke = refresh || conn.accessToken;
    if (tokenToRevoke) {
      await fetch(`${GOOGLE_REVOKE}?token=${encodeURIComponent(tokenToRevoke)}`, { method: 'POST' }).catch(() => undefined);
    }
    await this.connections.deleteOne({ _id: conn._id });
    return true;
  }

  /** What the Appointments page shows: this user's connection plus (for managers) the team's. */
  async status(tenantId: string, userId: string, includeTeam: boolean) {
    const [configured, mine, team] = await Promise.all([
      this.isConfigured(tenantId),
      this.connections.findOne({ tenantId, userId, provider: 'google' }).select('email calendarId lastError lastSyncedAt createdAt').lean(),
      includeTeam
        ? this.connections.find({ tenantId, provider: 'google' }).select('userId email lastError lastSyncedAt').lean()
        : Promise.resolve([] as any[]),
    ]);
    let teamRows: any[] = [];
    if (includeTeam) {
      const users: any[] = await this.userModel
        .find({ tenantId, isActive: true, role: { $in: ['ADMIN', 'SALES_MANAGER', 'SALESPERSON'] } })
        .select('firstName lastName email role')
        .lean();
      const byUser = new Map((team as any[]).map((c: any) => [String(c.userId), c]));
      teamRows = users.map((u: any) => {
        const c = byUser.get(String(u._id));
        return {
          userId: String(u._id),
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          role: u.role,
          connected: !!c,
          email: c?.email,
          lastError: c?.lastError,
        };
      });
    }
    return {
      provider: 'google',
      configured,
      redirectUri: this.redirectUri(),
      connected: !!mine,
      email: (mine as any)?.email,
      lastError: (mine as any)?.lastError,
      lastSyncedAt: (mine as any)?.lastSyncedAt,
      team: teamRows,
    };
  }

  async isConnected(tenantId: string, userId?: string): Promise<boolean> {
    if (!userId) return false;
    return !!(await this.connections.exists({ tenantId, userId, provider: 'google' }));
  }

  // ─── Tokens ───────────────────────────────────────────────────────

  private encryptionKey(): string {
    return this.configService.get<string>('encryption.key') || '';
  }

  private async accessTokenFor(conn: any, tenantId: string): Promise<string> {
    if (conn.accessToken && conn.accessTokenExpiresAt && new Date(conn.accessTokenExpiresAt).getTime() > Date.now() + 60_000) {
      return conn.accessToken;
    }
    const refresh = conn.refreshTokenEnc ? decryptSecret(conn.refreshTokenEnc, this.encryptionKey()) : null;
    if (!refresh) throw new Error('Calendar connection is missing its refresh token - reconnect Google Calendar');
    const client = await this.clientFor(tenantId);
    const res = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refresh,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        grant_type: 'refresh_token',
      }).toString(),
    });
    const token: any = await res.json().catch(() => ({}));
    if (!res.ok || !token.access_token) {
      const msg = token.error_description || token.error || `HTTP ${res.status}`;
      await this.connections.updateOne({ _id: conn._id }, { $set: { lastError: `Token refresh failed: ${msg}` } });
      throw new Error(`Google token refresh failed: ${msg}`);
    }
    await this.connections.updateOne(
      { _id: conn._id },
      { $set: { accessToken: token.access_token, accessTokenExpiresAt: new Date(Date.now() + Math.max(60, Number(token.expires_in) || 3600) * 1000), lastError: undefined } },
    );
    return token.access_token;
  }

  private async api(conn: any, tenantId: string, method: string, path: string, body?: any): Promise<{ ok: boolean; status: number; data: any }> {
    const token = await this.accessTokenFor(conn, tenantId);
    const res = await fetch(`${CAL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  }

  private connectionFor(tenantId: string, userId?: string) {
    if (!userId || !/^[a-f\d]{24}$/i.test(String(userId))) return null;
    return this.connections.findOne({ tenantId, userId: String(userId), provider: 'google' });
  }

  // ─── Free / busy ──────────────────────────────────────────────────

  /**
   * Everything on the salesperson's Google Calendar between two instants,
   * except the mirrored event of the appointment being moved. Empty when the
   * user has no calendar connected (the caller then relies on our own table).
   */
  async busyBetween(tenantId: string, userId: string | undefined, from: Date, to: Date, ignoreEventId?: string): Promise<BusyInterval[]> {
    const conn = await this.connectionFor(tenantId, userId);
    if (!conn) return [];
    try {
      const params = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      });
      const r = await this.api(conn, tenantId, 'GET', `/calendars/${encodeURIComponent(conn.calendarId || 'primary')}/events?${params}`);
      if (!r.ok) throw new Error(r.data?.error?.message || `HTTP ${r.status}`);
      const busy: BusyInterval[] = [];
      for (const ev of r.data.items || []) {
        if (ev.status === 'cancelled' || ev.transparency === 'transparent') continue;
        if (ignoreEventId && ev.id === ignoreEventId) continue;
        // Declined by this user -> not busy
        const me = (ev.attendees || []).find((a: any) => a.self);
        if (me && me.responseStatus === 'declined') continue;
        const s = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00` : null);
        const e = ev.end?.dateTime || (ev.end?.date ? `${ev.end.date}T00:00:00` : null);
        if (!s || !e) continue;
        if (ev.start?.date && !ev.start?.dateTime) continue; // all-day markers (birthdays, holidays) do not block meetings
        busy.push({ start: new Date(s), end: new Date(e), title: ev.summary, eventId: ev.id });
      }
      await this.connections.updateOne({ _id: conn._id }, { $set: { lastSyncedAt: new Date(), lastError: undefined } });
      return busy;
    } catch (err: any) {
      this.logger.warn(`Google free/busy failed for user ${userId}: ${err?.message}`);
      await this.connections.updateOne({ _id: conn._id }, { $set: { lastError: err?.message } }).catch(() => undefined);
      return [];
    }
  }

  /** The first Google event overlapping [start, end), or null. */
  async conflictFor(tenantId: string, userId: string | undefined, start: Date, end: Date, ignoreEventId?: string): Promise<BusyInterval | null> {
    const busy = await this.busyBetween(tenantId, userId, start, end, ignoreEventId);
    return busy.find((b) => b.start.getTime() < end.getTime() && b.end.getTime() > start.getTime()) || null;
  }

  // ─── Event sync ───────────────────────────────────────────────────

  private eventBody(appt: any, organizerName?: string) {
    const tz = appt.timezone || 'Asia/Kolkata';
    const lines = [
      appt.description,
      appt.attendee?.name && `Lead: ${appt.attendee.name}`,
      appt.attendee?.phone && `Phone: ${appt.attendee.phone}`,
      appt.attendee?.email && `E-mail: ${appt.attendee.email}`,
      appt.bookedBy === 'ai' ? 'Booked by the AI calling agent (LeadBells).' : 'Booked in LeadBells.',
    ].filter(Boolean);
    const attendees: any[] = [];
    if (appt.attendee?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appt.attendee.email)) {
      attendees.push({ email: appt.attendee.email, displayName: appt.attendee.name || undefined });
    }
    return {
      summary: appt.title || `Meeting with ${appt.attendee?.name || 'lead'}`,
      description: lines.join('\n'),
      location: appt.location || undefined,
      start: { dateTime: new Date(appt.startTime).toISOString(), timeZone: tz },
      end: { dateTime: new Date(appt.endTime).toISOString(), timeZone: tz },
      attendees: attendees.length ? attendees : undefined,
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }, { method: 'popup', minutes: 10 }] },
      extendedProperties: { private: { leadbellsAppointmentId: String(appt._id), leadbellsLeadId: String(appt.leadId || '') } },
      source: organizerName ? { title: `LeadBells · ${organizerName}`, url: this.configService.get<string>('app.url') || undefined } : undefined,
    };
  }

  /**
   * Create or update the mirrored event. Never throws - a calendar hiccup must
   * not undo a booking the AI already confirmed on the phone.
   */
  async upsertEvent(appointment: any): Promise<void> {
    const appt = typeof appointment?.toObject === 'function' ? appointment.toObject() : appointment;
    if (!appt?._id || !appt.tenantId) return;
    const conn = await this.connectionFor(appt.tenantId, appt.assignedTo);
    if (!conn) {
      // Salesperson changed to someone without a calendar: drop the stale event from the old one
      if (appt.externalCalendarId && appt.calendarProvider === 'google') {
        await this.deleteEventById(appt.tenantId, appt.externalCalendarId, appt.calendarOwnerUserId).catch(() => undefined);
        await this.appointmentModel.updateOne({ _id: appt._id }, { $unset: { externalCalendarId: 1, conferenceLink: 1 }, $set: { calendarProvider: 'internal' } });
      }
      return;
    }
    try {
      const owner: any = await this.userModel.findById(appt.assignedTo).select('firstName lastName').lean();
      const body: any = this.eventBody(appt, owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() : undefined);
      const calId = encodeURIComponent(conn.calendarId || 'primary');
      let r: { ok: boolean; status: number; data: any };

      if (appt.externalCalendarId && appt.calendarProvider === 'google') {
        r = await this.api(conn, appt.tenantId, 'PATCH', `/calendars/${calId}/events/${encodeURIComponent(appt.externalCalendarId)}?conferenceDataVersion=1&sendUpdates=none`, body);
        if (r.status === 404 || r.status === 410) r = { ok: false, status: 404, data: {} };
      } else {
        r = { ok: false, status: 404, data: {} };
      }
      if (!r.ok && r.status === 404) {
        body.conferenceData = { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } };
        r = await this.api(conn, appt.tenantId, 'POST', `/calendars/${calId}/events?conferenceDataVersion=1&sendUpdates=none`, body);
      }
      if (!r.ok) throw new Error(r.data?.error?.message || `HTTP ${r.status}`);

      const ev = r.data;
      const meet = ev.hangoutLink || ev.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;
      const set: any = {
        externalCalendarId: ev.id,
        calendarProvider: 'google',
        calendarOwnerUserId: String(appt.assignedTo),
        calendarSyncedAt: new Date(),
        calendarSyncError: '',
      };
      if (meet) {
        set.conferenceLink = meet;
        if (!appt.meetingLink) set.meetingLink = meet;
      }
      await this.appointmentModel.updateOne({ _id: appt._id }, { $set: set });
      await this.connections.updateOne({ _id: conn._id }, { $set: { lastSyncedAt: new Date(), lastError: undefined } });
      this.logger.log(`Appointment ${appt._id} synced to Google Calendar (${ev.id})`);
    } catch (err: any) {
      this.logger.warn(`Google Calendar sync failed for appointment ${appt._id}: ${err?.message}`);
      await this.appointmentModel.updateOne({ _id: appt._id }, { $set: { calendarSyncError: String(err?.message || 'sync failed').slice(0, 300) } }).catch(() => undefined);
      await this.connections.updateOne({ _id: conn._id }, { $set: { lastError: String(err?.message || 'sync failed').slice(0, 300) } }).catch(() => undefined);
    }
  }

  /** Remove the mirrored event (cancelled / deleted appointment). Never throws. */
  async deleteEvent(appointment: any): Promise<void> {
    const appt = typeof appointment?.toObject === 'function' ? appointment.toObject() : appointment;
    if (!appt?.externalCalendarId || appt.calendarProvider !== 'google') return;
    await this.deleteEventById(appt.tenantId, appt.externalCalendarId, appt.calendarOwnerUserId || appt.assignedTo).catch((err) =>
      this.logger.warn(`Google Calendar delete failed for appointment ${appt._id}: ${err?.message}`),
    );
    await this.appointmentModel
      .updateOne({ _id: appt._id }, { $unset: { externalCalendarId: 1 }, $set: { calendarSyncedAt: new Date() } })
      .catch(() => undefined);
  }

  private async deleteEventById(tenantId: string, eventId: string, userId?: string) {
    const conn = await this.connectionFor(tenantId, userId);
    if (!conn) return;
    const r = await this.api(conn, tenantId, 'DELETE', `/calendars/${encodeURIComponent(conn.calendarId || 'primary')}/events/${encodeURIComponent(eventId)}?sendUpdates=none`);
    if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(r.data?.error?.message || `HTTP ${r.status}`);
  }
}
