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
