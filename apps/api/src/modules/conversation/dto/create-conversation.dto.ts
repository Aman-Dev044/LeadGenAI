import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsNotEmpty()
  @IsString()
  agentId: string;

  @IsNotEmpty()
  @IsString()
  visitorId: string;

  @IsOptional()
  @IsObject()
  visitorInfo?: {
    url?: string;
    referrer?: string;
    userAgent?: string;
    ip?: string;
  };
}
