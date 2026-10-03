/**
 * The catalogue of external services a workspace can point at its own account,
 * and which of their fields are secret.
 *
 * `secret: true` fields are encrypted at rest and never leave the server - the
 * API answers with a mask, so nothing readable reaches the browser, the network
 * tab or a page's source. Everything else (endpoints, regions, limits) is plain
 * configuration and is returned as typed.
 *
 * `envKey` names the platform-level fallback used when a tenant leaves a field
 * empty, which is also what the UI shows as "using platform default".
 */

export type CredentialFieldType = 'text' | 'password' | 'number' | 'email' | 'select';

export interface CredentialField {
  key: string;
  label: string;
  type: CredentialFieldType;
  /** Encrypted at rest, write-only over the API. */
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  help?: string;
  envKey?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export interface CredentialProviderSpec {
  id: string;
  label: string;
  /** Grouping for the settings page. */
  category: 'ai' | 'calling' | 'prospecting' | 'messaging' | 'storage';
  description: string;
  docsUrl?: string;
  /** Free-tier or setup note shown under the card title. */
  note?: string;
  fields: CredentialField[];
  /** Whether this provider supports the "Test connection" button. */
  testable?: boolean;
}

export const CREDENTIAL_PROVIDERS: CredentialProviderSpec[] = [
  // ── AI ────────────────────────────────────────────────────────────────
  {
    id: 'ai',
    label: 'AI provider',
    category: 'ai',
    description:
      'Powers chat replies, lead scoring, knowledge-base embeddings and every AI feature in the dashboard.',
    docsUrl: 'https://platform.openai.com/api-keys',
    testable: true,
    fields: [
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        envKey: 'AI_PROVIDER',
        options: [
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic (Claude)' },
        ],
      },
      {
        key: 'openaiApiKey',
        label: 'OpenAI API key',
        type: 'password',
        secret: true,
        placeholder: 'sk-proj-...',
        envKey: 'OPENAI_API_KEY',
      },
      {
        key: 'openaiModel',
        label: 'OpenAI model',
        type: 'text',
        placeholder: 'gpt-4o',
        envKey: 'OPENAI_MODEL',
      },
      {
        key: 'anthropicApiKey',
        label: 'Anthropic API key',
        type: 'password',
        secret: true,
        placeholder: 'sk-ant-...',
        envKey: 'ANTHROPIC_API_KEY',
      },
      {
        key: 'anthropicModel',
        label: 'Anthropic model',
        type: 'text',
        placeholder: 'claude-sonnet-4-20250514',
        envKey: 'ANTHROPIC_MODEL',
      },
    ],
  },

  // ── Prospecting ───────────────────────────────────────────────────────
  {
    id: 'reddit',
    label: 'Reddit',
    category: 'prospecting',
    description: 'Leads Scrap AI reads public Reddit posts through the official Data API.',
    docsUrl: 'https://www.reddit.com/prefs/apps',
    note:
      "Create a \"script\" app on your own Reddit account. Reddit's free tier is licensed for " +
      'non-commercial use, so each workspace should use its own credentials.',
    testable: true,
    fields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'password',
        secret: true,
        envKey: 'REDDIT_CLIENT_ID',
      },
      {
        key: 'clientSecret',
        label: 'Client secret',
        type: 'password',
        secret: true,
        envKey: 'REDDIT_CLIENT_SECRET',
      },
      {
        key: 'userAgent',
        label: 'User agent',
        type: 'text',
        placeholder: 'web:yourapp:v1.0 (by /u/yourhandle)',
        help: 'Reddit rejects generic user agents with a 429. Use the format shown.',
        envKey: 'REDDIT_USER_AGENT',
      },
      {
        key: 'tokenUrl',
        label: 'Token URL',
        type: 'text',
        placeholder: 'https://www.reddit.com/api/v1/access_token',
        envKey: 'REDDIT_TOKEN_URL',
      },
      {
        key: 'apiBaseUrl',
        label: 'API base URL',
        type: 'text',
        placeholder: 'https://oauth.reddit.com',
        envKey: 'REDDIT_API_BASE_URL',
      },
    ],
  },
  {
    id: 'serpapi',
    label: 'SERP API',
    category: 'prospecting',
    description:
      'Powers the Quora and Web sources in Leads Scrap AI. Quora publishes no API, so search results are the only way in.',
    docsUrl: 'https://serpapi.com/manage-api-key',
    note: 'The free plan covers a few hundred searches a month, which is why each run is capped.',
    testable: true,
    fields: [
      {
        key: 'apiKey',
        label: 'API key',
        type: 'password',
        secret: true,
        envKey: 'SERPAPI_API_KEY',
      },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        placeholder: 'https://serpapi.com/search.json',
        envKey: 'SERPAPI_BASE_URL',
      },
      {
        key: 'engine',
        label: 'Search engine',
        type: 'text',
        placeholder: 'google',
        envKey: 'SERP_ENGINE',
      },
      {
        key: 'maxSearchesPerRun',
        label: 'Max searches per run',
        type: 'number',
        min: 1,
        max: 100,
        help: 'Each selected country costs its own search, so keep this in line with your monthly quota.',
        envKey: 'SERP_MAX_SEARCHES_PER_RUN',
      },
      {
        key: 'resultsPerSearch',
        label: 'Results per search',
        type: 'number',
        min: 1,
        max: 100,
        envKey: 'SERP_RESULTS_PER_SEARCH',
      },
      {
        key: 'keywordsPerSearch',
        label: 'Keywords per search',
        type: 'number',
        min: 1,
        max: 10,
        help: 'Phrases are OR-batched into one paid search. Higher stretches the quota further.',
        envKey: 'SERP_KEYWORDS_PER_SEARCH',
      },
    ],
  },
  {
    id: 'hackernews',
    label: 'Hacker News',
    category: 'prospecting',
    description: 'Free and keyless. Only change the endpoint if you proxy it.',
    note: 'No credentials needed - this source works out of the box.',
    fields: [
      {
        key: 'baseUrl',
        label: 'API base URL',
        type: 'text',
        placeholder: 'https://hn.algolia.com/api/v1',
        envKey: 'HN_API_BASE_URL',
      },
    ],
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    category: 'prospecting',
    description:
      'Post search across the AT Protocol network. Fast-growing and unusually open, with real timestamps on every post.',
    docsUrl: 'https://bsky.app/settings/app-passwords',
    note:
      'Free, but post search now needs a session. Sign in at bsky.app, open Settings > App Passwords, ' +
      'create one, and paste it here - never your account password.',
    testable: true,
    fields: [
      {
        key: 'identifier',
        label: 'Handle or email',
        type: 'text',
        placeholder: 'you.bsky.social',
        envKey: 'BLUESKY_IDENTIFIER',
      },
      {
        key: 'appPassword',
        label: 'App password',
        type: 'password',
        secret: true,
        help: 'Revocable, and cannot change your account. Settings > App Passwords.',
        envKey: 'BLUESKY_APP_PASSWORD',
      },
      {
        key: 'baseUrl',
        label: 'PDS endpoint',
        type: 'text',
        placeholder: 'https://bsky.social',
        envKey: 'BLUESKY_API_URL',
      },
    ],
  },
  {
    id: 'stackexchange',
    label: 'Stack Exchange',
    category: 'prospecting',
    description:
      'Question search across Stack Exchange. Software Recommendations is the highlight - every question there is someone choosing a tool to buy or build.',
    docsUrl: 'https://stackapps.com/apps/oauth/register',
    note:
      'Works with no key on a small shared quota. A free key raises it to 10,000 requests a day.',
    testable: true,
    fields: [
      {
        key: 'apiKey',
        label: 'API key (optional)',
        type: 'password',
        secret: true,
        envKey: 'STACK_EXCHANGE_KEY',
      },
      {
        key: 'sites',
        label: 'Sites to search',
        type: 'text',
        placeholder: 'softwarerecs, webmasters, serverfault',
        help: 'Comma separated site ids. Each site costs one request per phrase.',
        envKey: 'STACK_EXCHANGE_SITES',
      },
      {
        key: 'baseUrl',
        label: 'API base URL',
        type: 'text',
        placeholder: 'https://api.stackexchange.com/2.3',
        envKey: 'STACK_EXCHANGE_API_URL',
      },
    ],
  },
  {
    id: 'github',
    label: 'GitHub',
    category: 'prospecting',
    description:
      'Issues and discussions. One of the few sources whose search indexes the full body, so real briefs surface rather than just titles.',
    docsUrl: 'https://github.com/settings/tokens',
    note:
      'Works with no token at 10 searches/minute. A free personal access token - no scopes needed ' +
      'for public data - raises it to 30/minute.',
    testable: true,
    fields: [
      {
        key: 'token',
        label: 'Personal access token (optional)',
        type: 'password',
        secret: true,
        placeholder: 'github_pat_...',
        envKey: 'GITHUB_TOKEN',
      },
      {
        key: 'baseUrl',
        label: 'API base URL',
        type: 'text',
        placeholder: 'https://api.github.com',
        envKey: 'GITHUB_API_URL',
      },
    ],
  },
  {
    id: 'tenders',
    label: 'Public tenders (EU / UK / Canada)',
    category: 'prospecting',
    description:
      'Official government procurement feeds. Organisations publish budgeted software requirements with deadlines - the most explicit buying intent there is.',
    note:
      'No credentials at all. TED, UK Find a Tender and CanadaBuys are open data. Select GB, CA or an EU country on a campaign to choose which portals run.',
    testable: true,
    fields: [
      {
        key: 'tedUrl',
        label: 'TED (EU) endpoint',
        type: 'text',
        placeholder: 'https://api.ted.europa.eu/v3/notices/search',
        envKey: 'TED_API_URL',
      },
      {
        key: 'ukUrl',
        label: 'UK Find a Tender endpoint',
        type: 'text',
        placeholder: 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages',
        envKey: 'UK_FTS_API_URL',
      },
      {
        key: 'canadaUrl',
        label: 'CanadaBuys open-data CSV',
        type: 'text',
        placeholder: 'https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv',
        envKey: 'CANADABUYS_CSV_URL',
      },
    ],
  },
  {
    id: 'google_places',
    label: 'Google Maps (Places)',
    category: 'prospecting',
    description: 'Powers AI Automation - finding newly listed businesses on Google Maps.',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    note: 'Enable "Places API (New)" on a project with billing turned on.',
    testable: true,
    fields: [
      {
        key: 'apiKey',
        label: 'Places API key',
        type: 'password',
        secret: true,
        placeholder: 'AIza...',
        envKey: 'GOOGLE_PLACES_API_KEY',
      },
    ],
  },

  // ── Calling ───────────────────────────────────────────────────────────
  {
    id: 'vapi',
    label: 'Vapi (AI voice calls)',
    category: 'calling',
    description:
      'The AI agent that phones every new lead, qualifies it and hands the hot ones to your team. ' +
      'Salesperson calls are bridged through Twilio instead.',
    docsUrl: 'https://dashboard.vapi.ai',
    note:
      'Create a Vapi account, import (or buy) a phone number under Phone Numbers and paste its id here. ' +
      'Set the webhook secret to any long random string - the same value is sent back with every call report.',
    testable: true,
    fields: [
      {
        key: 'apiKey',
        label: 'Private API key',
        type: 'password',
        secret: true,
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        envKey: 'VAPI_API_KEY',
      },
      {
        key: 'phoneNumberId',
        label: 'Phone number id',
        type: 'text',
        placeholder: 'Vapi > Phone Numbers > id',
        envKey: 'VAPI_PHONE_NUMBER_ID',
        help: 'The outbound caller id. Twilio numbers can be imported into Vapi.',
      },
      {
        key: 'assistantId',
        label: 'Assistant id (optional)',
        type: 'text',
        placeholder: 'Leave empty to use the script from Settings > AI Calling',
        envKey: 'VAPI_ASSISTANT_ID',
        help: 'When set, this saved Vapi assistant is used and only the lead context is injected.',
      },
      {
        key: 'webhookSecret',
        label: 'Webhook secret',
        type: 'password',
        secret: true,
        placeholder: 'long random string',
        envKey: 'VAPI_WEBHOOK_SECRET',
        help: 'Sent by Vapi as x-vapi-secret; reports without it are rejected.',
      },
    ],
  },

  // ── Messaging ─────────────────────────────────────────────────────────
  {
    id: 'smtp',
    label: 'Email (SMTP)',
    category: 'messaging',
    description:
      'Outgoing email: lead alerts, appointment confirmations, follow-up sequences and verification codes.',
    note: 'For Gmail use an App Password, not your account password.',
    testable: true,
    fields: [
      { key: 'host', label: 'SMTP host', type: 'text', placeholder: 'smtp.gmail.com', envKey: 'SMTP_HOST' },
      { key: 'port', label: 'Port', type: 'number', min: 1, max: 65535, placeholder: '587', envKey: 'SMTP_PORT' },
      {
        key: 'user',
        label: 'Username',
        type: 'text',
        placeholder: 'you@yourdomain.com',
        envKey: 'SMTP_USER',
      },
      { key: 'pass', label: 'Password', type: 'password', secret: true, envKey: 'SMTP_PASS' },
      { key: 'fromEmail', label: 'From address', type: 'email', envKey: 'EMAIL_FROM' },
      { key: 'fromName', label: 'From name', type: 'text', envKey: 'EMAIL_FROM_NAME' },
    ],
  },
  {
    id: 'twilio',
    label: 'Twilio (SMS & WhatsApp)',
    category: 'messaging',
    description: 'Sends SMS and WhatsApp messages from follow-up workflows and notifications.',
    docsUrl: 'https://console.twilio.com',
    testable: true,
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'password', secret: true, envKey: 'TWILIO_ACCOUNT_SID' },
      { key: 'authToken', label: 'Auth token', type: 'password', secret: true, envKey: 'TWILIO_AUTH_TOKEN' },
      {
        key: 'phoneNumber',
        label: 'SMS number',
        type: 'text',
        placeholder: '+15551234567',
        envKey: 'TWILIO_PHONE_NUMBER',
      },
      {
        key: 'whatsappNumber',
        label: 'WhatsApp number',
        type: 'text',
        placeholder: '+15551234567',
        envKey: 'TWILIO_WHATSAPP_NUMBER',
        help: 'A WhatsApp sender approved in Twilio (Messaging > Senders). Messages outside the 24-hour window are sent as the templates below.',
      },
      {
        key: 'tplThankYou',
        label: 'Template: thank-you after call',
        type: 'text',
        placeholder: 'HX…',
        envKey: 'WHATSAPP_TPL_THANK_YOU',
        help: 'Twilio Content SID. Variables: {{1}} lead, {{2}} agent, {{3}} company, {{4}} next step.',
      },
      {
        key: 'tplAppointment',
        label: 'Template: appointment confirmed',
        type: 'text',
        placeholder: 'HX…',
        envKey: 'WHATSAPP_TPL_APPOINTMENT',
        help: '{{1}} lead, {{2}} date, {{3}} time, {{4}} salesperson, {{5}} contact, {{6}} company.',
      },
      {
        key: 'tplCallback',
        label: 'Template: callback scheduled',
        type: 'text',
        placeholder: 'HX…',
        envKey: 'WHATSAPP_TPL_CALLBACK',
        help: '{{1}} lead, {{2}} date, {{3}} time, {{4}} agent, {{5}} company.',
      },
      {
        key: 'tplMissedCall',
        label: 'Template: missed call',
        type: 'text',
        placeholder: 'HX…',
        envKey: 'WHATSAPP_TPL_MISSED_CALL',
        help: '{{1}} lead, {{2}} agent, {{3}} company.',
      },
      {
        key: 'tplReengage',
        label: 'Template: check-in (cold lead)',
        type: 'text',
        placeholder: 'HX…',
        envKey: 'WHATSAPP_TPL_REENGAGE',
        help: '{{1}} lead, {{2}} agent, {{3}} company, {{4}} what they wanted.',
      },
      {
        key: 'tplReminder',
        label: 'Template: meeting reminder',
        type: 'text',
        placeholder: 'HX…',
        envKey: 'WHATSAPP_TPL_REMINDER',
        help: '{{1}} lead, {{2}} when (tomorrow / in 1 hour), {{3}} date, {{4}} time, {{5}} salesperson, {{6}} contact, {{7}} company.',
      },
      {
        key: 'tplMissedMeeting',
        label: 'Template: missed meeting',
        type: 'text',
        placeholder: 'HX…',
        envKey: 'WHATSAPP_TPL_MISSED_MEETING',
        help: '{{1}} lead, {{2}} date, {{3}} time, {{4}} salesperson, {{5}} company.',
      },
    ],
  },

  // ── Calendar ──────────────────────────────────────────────────────────
  {
    id: 'google',
    label: 'Google Calendar',
    category: 'calling',
    description:
      'Meetings the AI books land in each salesperson\'s Google Calendar with a Google Meet link, and the AI only offers slots that are free there. Each person connects their own calendar from the Appointments page.',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    note: 'Create an OAuth client (Web application) with the redirect URI shown under Appointments > Google Calendar. Leave empty to use the platform\'s client.',
    fields: [
      { key: 'clientId', label: 'OAuth client ID', type: 'text', envKey: 'GOOGLE_CLIENT_ID', placeholder: '…apps.googleusercontent.com' },
      { key: 'clientSecret', label: 'OAuth client secret', type: 'password', secret: true, envKey: 'GOOGLE_CLIENT_SECRET' },
    ],
  },

  // ── Storage ───────────────────────────────────────────────────────────
  {
    id: 's3',
    label: 'File storage (S3)',
    category: 'storage',
    description: 'Where knowledge-base uploads and exports are kept. Any S3-compatible service works.',
    testable: true,
    fields: [
      { key: 'accessKeyId', label: 'Access key ID', type: 'password', secret: true, envKey: 'S3_ACCESS_KEY_ID' },
      {
        key: 'secretAccessKey',
        label: 'Secret access key',
        type: 'password',
        secret: true,
        envKey: 'S3_SECRET_ACCESS_KEY',
      },
      { key: 'region', label: 'Region', type: 'text', placeholder: 'ap-south-1', envKey: 'S3_REGION' },
      { key: 'bucket', label: 'Bucket', type: 'text', envKey: 'S3_BUCKET' },
      {
        key: 'endpoint',
        label: 'Endpoint',
        type: 'text',
        placeholder: 'Leave empty for AWS',
        help: 'Set this for MinIO, Cloudflare R2, Wasabi and other S3-compatible services.',
        envKey: 'S3_ENDPOINT',
      },
    ],
  },
];

export const CREDENTIAL_PROVIDER_IDS = CREDENTIAL_PROVIDERS.map((p) => p.id);

export function getProviderSpec(id: string): CredentialProviderSpec | undefined {
  return CREDENTIAL_PROVIDERS.find((p) => p.id === id);
}

/** Field keys of a provider that must be encrypted and never returned. */
export function secretFieldsOf(id: string): string[] {
  return (getProviderSpec(id)?.fields || []).filter((f) => f.secret).map((f) => f.key);
}
