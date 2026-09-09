import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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
