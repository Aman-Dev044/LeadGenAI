import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment;

  @IsNumber()
  @IsOptional()
  @Min(1)
  API_PORT: number;

  // Database
  @IsString()
  @IsNotEmpty()
  MONGODB_URI: string;

  // JWT
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  // AI Providers
  @IsString()
  @IsOptional()
  OPENAI_API_KEY: string;

  @IsString()
  @IsOptional()
  ANTHROPIC_API_KEY: string;

  // Google Maps prospecting (AI Automation)
  @IsString()
  @IsOptional()
  GOOGLE_PLACES_API_KEY: string;

  // AI calling (Vapi) + public URL for provider webhooks
  @IsString()
  @IsOptional()
  PUBLIC_API_URL: string;

  @IsString()
  @IsOptional()
  VAPI_API_KEY: string;

  @IsString()
  @IsOptional()
  VAPI_PHONE_NUMBER_ID: string;

  @IsString()
  @IsOptional()
  VAPI_ASSISTANT_ID: string;

  @IsString()
  @IsOptional()
  VAPI_WEBHOOK_SECRET: string;

  // Google Calendar OAuth (meetings booked by the AI land in the salesperson's calendar)
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET: string;

  @IsString()
  @IsOptional()
  GOOGLE_REDIRECT_URI: string;

  @IsNumber()
  @IsOptional()
  @Min(30000)
  APPOINTMENT_REMINDER_POLL_INTERVAL_MS: number;

  @IsNumber()
  @IsOptional()
  @Min(5000)
  CALLING_POLL_INTERVAL_MS: number;

  @IsNumber()
  @IsOptional()
  @Min(60000)
  CALLING_REENGAGE_INTERVAL_MS: number;

  @IsNumber()
  @IsOptional()
  @Min(30000)
  FOLLOW_UP_TASK_POLL_INTERVAL_MS: number;

  // Encryption
  @IsString()
  @IsOptional()
  ENCRYPTION_KEY: string;

  // SMTP (optional)
  @IsString()
  @IsOptional()
  SMTP_HOST: string;

  @IsString()
  @IsOptional()
  SMTP_EMAIL: string;

  @IsString()
  @IsOptional()
  SMTP_PASSWORD: string;

  // Storage
  @IsString()
  @IsOptional()
  S3_ACCESS_KEY_ID: string;

  @IsString()
  @IsOptional()
  S3_SECRET_ACCESS_KEY: string;

  @IsString()
  @IsOptional()
  S3_BUCKET: string;

  // Email
  @IsString()
  @IsOptional()
  RESEND_API_KEY: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM: string;

  // Webhook
  @IsString()
  @IsOptional()
  WEBHOOK_SECRET: string;

  // Rate Limiting
  @IsNumber()
  @IsOptional()
  @Min(1)
  RATE_LIMIT_TTL: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  RATE_LIMIT_MAX: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  RATE_LIMIT_WIDGET_TTL: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  RATE_LIMIT_WIDGET_MAX: number;

  // Bcrypt
  @IsNumber()
  @IsOptional()
  @Min(4)
  BCRYPT_SALT_ROUNDS: number;

  // Upstash Redis
  @IsString()
  @IsOptional()
  UPSTASH_REDIS_REST_URL: string;

  @IsString()
  @IsOptional()
  UPSTASH_REDIS_REST_TOKEN: string;

  // Leads Scrap AI - every source is optional; a missing key just marks that
  // source "not configured" in the UI instead of breaking boot.
  @IsString()
  @IsOptional()
  REDDIT_CLIENT_ID: string;

  @IsString()
  @IsOptional()
  REDDIT_CLIENT_SECRET: string;

  @IsString()
  @IsOptional()
  REDDIT_USER_AGENT: string;

  @IsString()
  @IsOptional()
  REDDIT_TOKEN_URL: string;

  @IsString()
  @IsOptional()
  REDDIT_API_BASE_URL: string;

  @IsString()
  @IsOptional()
  HN_API_BASE_URL: string;

  @IsString()
  @IsOptional()
  SERPAPI_API_KEY: string;

  @IsString()
  @IsOptional()
  SERPAPI_BASE_URL: string;

  @IsString()
  @IsOptional()
  SERP_ENGINE: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  SERP_MAX_SEARCHES_PER_RUN: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  SERP_RESULTS_PER_SEARCH: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  SERP_KEYWORDS_PER_SEARCH: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  SOCIAL_PROSPECTING_MAX_RESULTS: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  SOCIAL_PROSPECTING_MAX_MESSAGES_PER_RUN: number;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  SOCIAL_PROSPECTING_HTTP_TIMEOUT_MS: number;

  @IsNumber()
  @IsOptional()
  @Min(10000)
  SOCIAL_PROSPECTING_POLL_INTERVAL_MS: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: true,
  });

  if (errors.length > 0) {
    throw new Error(`Config validation error: ${errors.toString()}`);
  }
  return validatedConfig;
}
