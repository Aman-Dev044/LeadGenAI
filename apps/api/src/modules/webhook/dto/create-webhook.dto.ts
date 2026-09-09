import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateWebhookDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  url: string;

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @IsOptional()
  @IsObject()
  config?: {
    contentType?: string;
    retryCount?: number;
    timeoutMs?: number;
  };
}
