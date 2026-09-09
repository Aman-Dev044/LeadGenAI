import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  config?: {
    contentType?: string;
    retryCount?: number;
    timeoutMs?: number;
  };
}
