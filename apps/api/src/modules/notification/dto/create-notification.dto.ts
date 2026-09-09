import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  recipient?: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsNotEmpty()
  @IsEnum([
    'new_lead',
    'lead_scored',
    'handoff_request',
    'conversation_ended',
    'system_alert',
    'assignment',
    'kb_processing',
    'follow_up',
    'appointment',
    'support_ticket',
  ])
  type: string;

  @IsNotEmpty()
  @IsEnum(['email', 'in_app', 'sms', 'whatsapp', 'slack', 'teams', 'push'])
  channel: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
