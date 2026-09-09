import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class RecordPageViewDto {
  @IsNotEmpty()
  @IsString()
  agentId: string;

  @IsNotEmpty()
  @IsString()
  visitorId: string;

  @IsNotEmpty()
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  referrer?: string;

  @IsOptional()
  @IsObject()
  utm?: Record<string, string>;
}
