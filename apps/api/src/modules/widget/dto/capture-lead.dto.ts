import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CaptureLeadDto {
  @IsNotEmpty()
  @IsString()
  agentId: string;

  @IsNotEmpty()
  @IsString()
  visitorId: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsNotEmpty()
  @IsObject()
  data: Record<string, string>;
}
