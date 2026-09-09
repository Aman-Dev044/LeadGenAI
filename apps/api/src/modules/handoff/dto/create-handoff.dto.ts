import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHandoffDto {
  @IsNotEmpty()
  @IsString()
  conversationId: string;

  @IsNotEmpty()
  @IsString()
  agentId: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
