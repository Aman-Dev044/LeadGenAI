import { Injectable, Logger } from '@nestjs/common';
import { CredentialsService, ResolvedCredentials } from './credentials.service';

const TIMEOUT_MS = 15_000;

export interface TestResult {
  ok: boolean;
  message: string;
}

/**
 * "Test connection" for each integration.
 *
 * Every check is the cheapest read-only call the service offers, so pressing the
 * button never sends an email, never posts anything and costs at most one unit
 * of quota. Failures are reported as a readable sentence rather than a stack
 * trace, and no secret is ever echoed back in the message.
 */
@Injectable()
export class CredentialTesterService {
  private readonly logger = new Logger(CredentialTesterService.name);

  constructor(private readonly credentials: CredentialsService) {}

  async test(tenantId: string, providerId: string): Promise<TestResult> {
    const creds = await this.credentials.resolve(tenantId, providerId);
    try {
      const result = await this.run(providerId, creds);
      await this.credentials.recordTest(tenantId, providerId, result.ok, result.message);
      return result;
    } catch (err: any) {
      const message = err?.message || 'Connection failed';
      await this.credentials.recordTest(tenantId, providerId, false, message);
      return { ok: false, message };
    }
  }

  private run(providerId: string, creds: ResolvedCredentials): Promise<TestResult> {
    switch (providerId) {
      case 'ai':
        return this.testAi(creds);
      case 'reddit':
        return this.testReddit(creds);
      case 'serpapi':
        return this.testSerpApi(creds);
      case 'google_places':
        return this.testPlaces(creds);
      case 'smtp':
        return this.testSmtp(creds);
      case 'twilio':
        return this.testTwilio(creds);
      case 'vapi':
        return this.testVapi(creds);
      case 's3':
        return this.testS3(creds);
      case 'tenders':
        return this.testTenders(creds);
      case 'bluesky':
        return this.testBluesky(creds);
      case 'stackexchange':
        return this.testStackExchange(creds);
      case 'github':
        return this.testGitHub(creds);
      default:
        return Promise.resolve({ ok: true, message: 'Nothing to test for this integration.' });
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Timed out after 15s');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Lists models - the cheapest authenticated GET both vendors expose. */
  private async testAi(creds: ResolvedCredentials): Promise<TestResult> {
    const provider = (creds.provider || 'openai').toLowerCase();

    if (provider === 'anthropic') {
      if (!creds.anthropicApiKey) return { ok: false, message: 'No Anthropic API key saved.' };
      const res = await this.fetchWithTimeout('https://api.anthropic.com/v1/models?limit=1', {
        headers: { 'x-api-key': creds.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      });
      if (res.ok) return { ok: true, message: 'Anthropic key accepted.' };
      if (res.status === 401) return { ok: false, message: 'Anthropic rejected the key.' };
      return { ok: false, message: `Anthropic returned ${res.status}.` };
    }

    if (!creds.openaiApiKey) return { ok: false, message: 'No OpenAI API key saved.' };
    const res = await this.fetchWithTimeout('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${creds.openaiApiKey}` },
    });
    if (res.ok) return { ok: true, message: 'OpenAI key accepted.' };
    if (res.status === 401) return { ok: false, message: 'OpenAI rejected the key.' };
    if (res.status === 429) return { ok: false, message: 'OpenAI key is valid but rate limited or out of quota.' };
    return { ok: false, message: `OpenAI returned ${res.status}.` };
  }

  /** Mints an app-only token; proves the id, secret and user agent all work. */
  private async testReddit(creds: ResolvedCredentials): Promise<TestResult> {
    if (!creds.clientId || !creds.clientSecret) {
      return { ok: false, message: 'Client ID and secret are both required.' };
    }
    if (!creds.userAgent) {
      return { ok: false, message: 'Reddit refuses requests without a descriptive user agent.' };
    }

    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    const res = await this.fetchWithTimeout(
      creds.tokenUrl || 'https://www.reddit.com/api/v1/access_token',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': creds.userAgent,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      },
    );

    if (res.status === 401) return { ok: false, message: 'Reddit rejected the client ID or secret.' };
    if (res.status === 429) {
      return { ok: false, message: 'Reddit rate limited the check - usually a generic user agent.' };
    }
    const json: any = await res.json().catch(() => ({}));
    if (json?.access_token) return { ok: true, message: 'Reddit credentials accepted.' };
    return { ok: false, message: `Reddit returned ${res.status} with no token.` };
  }

  /** Reads the account endpoint, which does not consume a search. */
  private async testSerpApi(creds: ResolvedCredentials): Promise<TestResult> {
    if (!creds.apiKey) return { ok: false, message: 'No SERP API key saved.' };

    const res = await this.fetchWithTimeout(
      `https://serpapi.com/account.json?api_key=${encodeURIComponent(creds.apiKey)}`,
    );
    const json: any = await res.json().catch(() => ({}));
    if (json?.error) return { ok: false, message: String(json.error) };
    if (!res.ok) return { ok: false, message: `SERP API returned ${res.status}.` };

    const left = json?.plan_searches_left;
    const plan = json?.plan_name || 'plan';
    return {
      ok: true,
      message:
        typeof left === 'number'
          ? `Connected. ${left} searches left this month on the ${plan}.`
          : 'SERP API key accepted.',
    };
  }

  /** One minimal Text Search - the smallest billable Places call. */
  private async testPlaces(creds: ResolvedCredentials): Promise<TestResult> {
    if (!creds.apiKey) return { ok: false, message: 'No Places API key saved.' };

    const res = await this.fetchWithTimeout('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': creds.apiKey,
        'X-Goog-FieldMask': 'places.id',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ textQuery: 'cafe', maxResultCount: 1 }),
    });

    const json: any = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, message: 'Places API key accepted.' };
    const reason = json?.error?.message || `HTTP ${res.status}`;
    return { ok: false, message: `Google rejected the key: ${reason}` };
  }

  /** Opens and verifies the SMTP connection without sending a message. */
  private async testSmtp(creds: ResolvedCredentials): Promise<TestResult> {
    if (!creds.host) return { ok: false, message: 'No SMTP host saved.' };

    // Imported lazily so the vault does not drag nodemailer into every boot path.
    const nodemailer = await import('nodemailer');
    const port = Number(creds.port) || 587;
    const transporter = nodemailer.createTransport({
      host: creds.host,
      port,
      secure: port === 465,
      // On a submission port, refuse to fall back to an unencrypted session.
      ...(port === 465 ? {} : { requireTLS: true }),
      ...(creds.user && creds.pass
        ? // App passwords are displayed in groups of four; the spaces are
          // cosmetic and some servers reject them.
          { auth: { user: creds.user.trim(), pass: creds.pass.replace(/\s+/g, '') } }
        : {}),
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
    });

    try {
      await transporter.verify();
      return { ok: true, message: `Connected to ${creds.host}:${port}.` };
    } catch (err: any) {
      // nodemailer's raw messages ("Connection timeout") say nothing about what
      // to do next, and these four causes need four different fixes.
      const code = err?.code || '';
      if (code === 'EAUTH') {
        return {
          ok: false,
          message:
            'The server rejected the username or password. For Gmail this must be an App Password, ' +
            'not your account password.',
        };
      }
      if (code === 'ENOTFOUND' || code === 'EDNS') {
        return { ok: false, message: `Could not resolve "${creds.host}" - check the host name.` };
      }
      if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ESOCKET') {
        return {
          ok: false,
          message:
            `Could not reach ${creds.host}:${port} in time. Usually the port is blocked by a firewall ` +
            'or the mail server is throttling repeated checks - wait a moment and test again, or try port 465.',
        };
      }
      return { ok: false, message: err?.message || 'SMTP connection failed.' };
    } finally {
      transporter.close();
    }
  }

  /** Reads the phone number record - proves the key and that the number id belongs to it. */
  private async testVapi(creds: ResolvedCredentials): Promise<TestResult> {
    if (!creds.apiKey) return { ok: false, message: 'No Vapi API key saved.' };
    const headers = { Authorization: `Bearer ${creds.apiKey}` };

    if (creds.phoneNumberId) {
      const res = await this.fetchWithTimeout(
        `https://api.vapi.ai/phone-number/${encodeURIComponent(creds.phoneNumberId)}`,
        { headers },
      );
      if (res.status === 401) return { ok: false, message: 'Vapi rejected the API key.' };
      if (res.status === 404) return { ok: false, message: 'Key accepted, but no phone number has that id.' };
      if (!res.ok) return { ok: false, message: `Vapi returned ${res.status}.` };
      const json: any = await res.json().catch(() => ({}));
      return { ok: true, message: `Connected. Outbound number ${json?.number || 'ready'}.` };
    }

    const res = await this.fetchWithTimeout('https://api.vapi.ai/assistant?limit=1', { headers });
    if (res.status === 401) return { ok: false, message: 'Vapi rejected the API key.' };
    if (!res.ok) return { ok: false, message: `Vapi returned ${res.status}.` };
    return { ok: true, message: 'Vapi key accepted. Add a phone number id to place calls.' };
  }

  /** Fetches the account record the SID belongs to. Sends nothing. */
  private async testTwilio(creds: ResolvedCredentials): Promise<TestResult> {
    if (!creds.accountSid || !creds.authToken) {
      return { ok: false, message: 'Account SID and auth token are both required.' };
    }

    const basic = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
    const res = await this.fetchWithTimeout(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}.json`,
      { headers: { Authorization: `Basic ${basic}` } },
    );

    if (res.status === 401) return { ok: false, message: 'Twilio rejected the SID or auth token.' };
    if (!res.ok) return { ok: false, message: `Twilio returned ${res.status}.` };
    const json: any = await res.json().catch(() => ({}));
    return { ok: true, message: `Connected to Twilio account "${json?.friendly_name || 'account'}".` };
  }

  /** Creates a session - proves the handle and app password together. */
  private async testBluesky(creds: ResolvedCredentials): Promise<TestResult> {
    if (!creds.identifier || !creds.appPassword) {
      return { ok: false, message: 'Handle and app password are both required.' };
    }
    const res = await this.fetchWithTimeout(
      `${creds.baseUrl || 'https://bsky.social'}/xrpc/com.atproto.server.createSession`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: creds.identifier.replace(/^@/, ''),
          password: creds.appPassword,
        }),
      },
    );
    if (res.ok) return { ok: true, message: `Signed in as ${creds.identifier}.` };
    if (res.status === 401) {
      return {
        ok: false,
        message:
          'Bluesky rejected the sign-in. Make sure this is an App Password from ' +
          'Settings > App Passwords, not your account password.',
      };
    }
    return { ok: false, message: `Bluesky returned ${res.status}.` };
  }

  /** One cheap question search; the response reports the remaining quota. */
  private async testStackExchange(creds: ResolvedCredentials): Promise<TestResult> {
    const base = creds.baseUrl || 'https://api.stackexchange.com/2.3';
    const search = new URLSearchParams({ order: 'desc', sort: 'creation', site: 'softwarerecs', pagesize: '1' });
    if (creds.apiKey) search.set('key', creds.apiKey);

    const res = await this.fetchWithTimeout(`${base}/questions?${search.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    const json: any = await res.json().catch(() => ({}));
    if (json?.error_message) return { ok: false, message: String(json.error_message) };
    if (!res.ok) return { ok: false, message: `Stack Exchange returned ${res.status}.` };

    const left = json?.quota_remaining;
    return {
      ok: true,
      message:
        typeof left === 'number'
          ? `Connected. ${left} requests left today${creds.apiKey ? '' : ' (no key - small shared quota)'}.`
          : 'Stack Exchange reachable.',
    };
  }

  /** Reads the rate limit, which costs nothing against the search allowance. */
  private async testGitHub(creds: ResolvedCredentials): Promise<TestResult> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'LeadGenAI-prospecting',
    };
    if (creds.token) headers.Authorization = `Bearer ${creds.token}`;

    const res = await this.fetchWithTimeout(
      `${creds.baseUrl || 'https://api.github.com'}/rate_limit`,
      { headers },
    );
    if (res.status === 401) return { ok: false, message: 'GitHub rejected the token.' };
    if (!res.ok) return { ok: false, message: `GitHub returned ${res.status}.` };

    const json: any = await res.json().catch(() => ({}));
    const perMinute = json?.resources?.search?.limit;
    return {
      ok: true,
      message: creds.token
        ? `Token accepted. ${perMinute ?? 30} searches/minute.`
        : `Reachable without a token (${perMinute ?? 10} searches/minute). A free token raises this.`,
    };
  }

  /**
   * Open government feeds, so there is nothing to authenticate - the check is
   * simply whether each portal is reachable and answering.
   */
  private async testTenders(creds: ResolvedCredentials): Promise<TestResult> {
    const checks: { label: string; run: () => Promise<boolean> }[] = [
      {
        label: 'TED (EU)',
        run: async () => {
          const res = await this.fetchWithTimeout(
            creds.tedUrl || 'https://api.ted.europa.eu/v3/notices/search',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: 'classification-cpv=72*',
                fields: ['publication-number'],
                limit: 1,
              }),
            },
          );
          return res.ok;
        },
      },
      {
        label: 'UK Find a Tender',
        run: async () => {
          const res = await this.fetchWithTimeout(
            `${creds.ukUrl || 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages'}?limit=1`,
          );
          return res.ok;
        },
      },
      {
        label: 'CanadaBuys',
        run: async () => {
          // HEAD avoids pulling the multi-megabyte CSV just to prove it is up.
          const res = await this.fetchWithTimeout(
            creds.canadaUrl ||
              'https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv',
            { method: 'HEAD' },
          );
          return res.ok;
        },
      },
    ];

    const results = await Promise.all(
      checks.map(async (c) => {
        try {
          return { label: c.label, ok: await c.run() };
        } catch {
          return { label: c.label, ok: false };
        }
      }),
    );

    const up = results.filter((r) => r.ok).map((r) => r.label);
    const down = results.filter((r) => !r.ok).map((r) => r.label);

    if (!up.length) return { ok: false, message: 'No tender portal responded.' };
    return {
      // One portal being down should not read as a broken integration.
      ok: true,
      message: down.length
        ? `Reachable: ${up.join(', ')}. Not responding right now: ${down.join(', ')}.`
        : `All three portals reachable: ${up.join(', ')}.`,
    };
  }

  /** Heads the bucket - proves credentials, region and endpoint together. */
  private async testS3(creds: ResolvedCredentials): Promise<TestResult> {
    if (!creds.accessKeyId || !creds.secretAccessKey) {
      return { ok: false, message: 'Access key and secret are both required.' };
    }
    if (!creds.bucket) return { ok: false, message: 'No bucket name saved.' };

    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: creds.region || 'us-east-1',
      endpoint: creds.endpoint || undefined,
      forcePathStyle: true,
      credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey },
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: creds.bucket }));
      return { ok: true, message: `Bucket "${creds.bucket}" is reachable.` };
    } catch (err: any) {
      const code = err?.name || err?.Code || '';
      if (code === 'NotFound') return { ok: false, message: `Bucket "${creds.bucket}" does not exist.` };
      if (code === 'Forbidden' || code === 'AccessDenied') {
        return { ok: false, message: 'Credentials are valid but lack access to that bucket.' };
      }
      return { ok: false, message: err?.message || 'Could not reach the bucket.' };
    } finally {
      client.destroy();
    }
  }
}
