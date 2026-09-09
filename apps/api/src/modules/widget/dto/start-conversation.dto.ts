import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class StartConversationDto {
  @IsNotEmpty()
  @IsString()
  agentId: string;

  @IsNotEmpty()
  @IsString()
  visitorId: string;

  @IsOptional()
  @IsObject()
  visitorInfo?: Record<string, string>;
}
