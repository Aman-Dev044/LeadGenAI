const int = (val: string | undefined, fallback: number) => {
  const parsed = parseInt(val || '', 10);
  return isNaN(parsed) ? fallback : parsed;
};

const float = (val: string | undefined, fallback: number) => {
  const parsed = parseFloat(val || '');
  return isNaN(parsed) ? fallback : parsed;
};

const isProd = process.env.NODE_ENV === 'production';

const requireInProd = (val: string | undefined, name: string, fallback: string): string => {
  if (val) return val;
  if (isProd) throw new Error(`${name} is required in production`);
  return fallback;
};

export default () => ({
  app: {
    name: process.env.APP_NAME || 'AI_Lead_Generation',
    url: process.env.APP_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:4000',
    // Internet-reachable base for provider webhooks (Vapi call reports, Twilio
    // TwiML/recording callbacks). In development point it at an ngrok tunnel.
    publicApiUrl: process.env.PUBLIC_API_URL || process.env.API_URL || 'http://localhost:4000',
    port: int(process.env.API_PORT, 4000),
    prefix: process.env.API_PREFIX || '/api/v1',
    env: process.env.NODE_ENV || 'development',
  },
  cors: {
    origins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
    methods: process.env.CORS_ALLOWED_METHODS || 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    headers: process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization',
    maxAge: int(process.env.CORS_MAX_AGE, 86400),
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_lead_gen',
    dbName: process.env.MONGODB_DB_NAME || 'ai_lead_gen',
    minPoolSize: int(process.env.MONGODB_MIN_POOL_SIZE, 5),
    maxPoolSize: int(process.env.MONGODB_MAX_POOL_SIZE, 20),
  },
  upstashRedis: {
    restUrl: process.env.UPSTASH_REDIS_REST_URL || '',
    restToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    // Defaults to <PUBLIC_API_URL>/api/v1/calendar/google/callback
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  },
  jwt: {
    accessSecret: requireInProd(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: requireInProd(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  bcrypt: {
    saltRounds: int(process.env.BCRYPT_SALT_ROUNDS, 12),
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      maxTokens: int(process.env.OPENAI_MAX_TOKENS, 2048),
      temperature: float(process.env.OPENAI_TEMPERATURE, 0.7),
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      maxTokens: int(process.env.ANTHROPIC_MAX_TOKENS, 2048),
    },
  },
  // AI calling (Vapi) - platform-level fallbacks; tenants normally bring their own
  vapi: {
    apiKey: process.env.VAPI_API_KEY || '',
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID || '',
    assistantId: process.env.VAPI_ASSISTANT_ID || '',
    webhookSecret: process.env.VAPI_WEBHOOK_SECRET || '',
  },
  // Google Maps prospecting (AI Automation). Places API (New) key.
  googlePlaces: {
    apiKey: process.env.GOOGLE_PLACES_API_KEY || '',
  },
  // Leads Scrap AI - social/forum prospecting. Every source is on a free tier;
  // endpoints are configurable so a provider can be swapped without a code change.
  socialProspecting: {
    // Hard ceiling on prospects stored per run, whatever a campaign asks for.
    maxResultsPerRun: int(process.env.SOCIAL_PROSPECTING_MAX_RESULTS, 300),
    // Outreach drafting is one AI call per post, so it is bounded separately.
    maxMessagesPerRun: int(process.env.SOCIAL_PROSPECTING_MAX_MESSAGES_PER_RUN, 25),
    reddit: {
      clientId: process.env.REDDIT_CLIENT_ID || '',
      clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
      // Reddit rejects requests with a generic UA. Format: platform:appid:version (by /u/handle)
      userAgent: process.env.REDDIT_USER_AGENT || '',
      tokenUrl: process.env.REDDIT_TOKEN_URL || 'https://www.reddit.com/api/v1/access_token',
      apiBaseUrl: process.env.REDDIT_API_BASE_URL || 'https://oauth.reddit.com',
    },
    hackerNews: {
      // Algolia's HN index: free, no key, no signup.
      baseUrl: process.env.HN_API_BASE_URL || 'https://hn.algolia.com/api/v1',
    },
    serp: {
      apiKey: process.env.SERPAPI_API_KEY || '',
      baseUrl: process.env.SERPAPI_BASE_URL || 'https://serpapi.com/search.json',
      engine: process.env.SERP_ENGINE || 'google',
      // The free SERP tier is ~100 searches/month, so a single run must never
      // spend more than a small slice of it.
      maxSearchesPerRun: int(process.env.SERP_MAX_SEARCHES_PER_RUN, 6),
      resultsPerSearch: int(process.env.SERP_RESULTS_PER_SEARCH, 20),
      // Phrases OR-batched into one search. Google truncates very long
      // queries, so keep this modest.
      keywordsPerSearch: int(process.env.SERP_KEYWORDS_PER_SEARCH, 5),
    },
    bluesky: {
      // Free Bluesky account + an App Password (never the account password).
      identifier: process.env.BLUESKY_IDENTIFIER || '',
      appPassword: process.env.BLUESKY_APP_PASSWORD || '',
      baseUrl: process.env.BLUESKY_API_URL || 'https://bsky.social',
    },
    stackExchange: {
      // Optional: without a key the shared daily quota is small but usable.
      apiKey: process.env.STACK_EXCHANGE_KEY || '',
      baseUrl: process.env.STACK_EXCHANGE_API_URL || 'https://api.stackexchange.com/2.3',
      sites: process.env.STACK_EXCHANGE_SITES || '',
    },
    github: {
      // Optional: a token only raises the search rate limit.
      token: process.env.GITHUB_TOKEN || '',
      baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    },
    // Official procurement feeds - open data, no credentials of any kind.
    tenders: {
      tedUrl: process.env.TED_API_URL || 'https://api.ted.europa.eu/v3/notices/search',
      ukUrl:
        process.env.UK_FTS_API_URL ||
        'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages',
      canadaUrl:
        process.env.CANADABUYS_CSV_URL ||
        'https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv',
    },
    httpTimeoutMs: int(process.env.SOCIAL_PROSPECTING_HTTP_TIMEOUT_MS, 30000),
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 's3',
    s3: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      region: process.env.S3_REGION || 'ap-south-1',
      bucket: process.env.S3_BUCKET || 'ai-lead-gen-uploads',
      endpoint: process.env.S3_ENDPOINT || undefined,
    },
  },
  email: {
    // smtp | resend (defaults to smtp when SMTP_HOST is set)
    provider: process.env.EMAIL_PROVIDER || (process.env.SMTP_HOST ? 'smtp' : 'resend'),
    from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || process.env.SMTP_EMAIL || process.env.SMTP_USER || 'noreply@yourdomain.com',
    fromName: process.env.EMAIL_FROM_NAME || process.env.FROM_NAME || 'AI Lead Gen',
    resendApiKey: process.env.RESEND_API_KEY || '',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: int(process.env.SMTP_PORT, 587),
      // true for port 465 (implicit TLS); false for 587 (STARTTLS)
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : int(process.env.SMTP_PORT, 587) === 465,
      user: process.env.SMTP_USER || process.env.SMTP_EMAIL || '',
      pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '',
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
    },
  },
  rateLimit: {
    ttl: int(process.env.RATE_LIMIT_TTL, 60),
    max: int(process.env.RATE_LIMIT_MAX, 100),
    widgetTtl: int(process.env.RATE_LIMIT_WIDGET_TTL, 60),
    widgetMax: int(process.env.RATE_LIMIT_WIDGET_MAX, 30),
  },
  webhook: {
    secret: process.env.WEBHOOK_SECRET || '',
    timeoutMs: int(process.env.WEBHOOK_TIMEOUT_MS, 10000),
    maxRetries: int(process.env.WEBHOOK_MAX_RETRIES, 3),
  },
  encryption: {
    key: requireInProd(process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY', 'dev-encryption-key-32-chars-long!!'),
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
  },
  // Platform owner account created/refreshed by `npm run seed`
  superAdmin: {
    tenantName: process.env.SUPER_ADMIN_TENANT_NAME || 'Platform Owner',
    tenantSlug: (process.env.SUPER_ADMIN_TENANT_SLUG || 'owner').toLowerCase(),
    email: (process.env.SUPER_ADMIN_EMAIL || 'superadmin@lead.ai').toLowerCase(),
    password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@Lead.AI',
    firstName: process.env.SUPER_ADMIN_FIRST_NAME || 'Super',
    lastName: process.env.SUPER_ADMIN_LAST_NAME || 'Admin',
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    title: process.env.SWAGGER_TITLE || 'AI Lead Generation API',
    version: process.env.SWAGGER_VERSION || '1.0',
    path: process.env.SWAGGER_PATH || '/api/docs',
  },
});
