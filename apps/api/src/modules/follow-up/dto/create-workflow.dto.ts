import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowStepDto {
  @IsNotEmpty()
  order: number;

  @IsNotEmpty()
  delayMinutes: number;

  @IsNotEmpty()
  @IsEnum(['send_email', 'send_sms', 'send_whatsapp', 'notify_salesperson', 'change_status', 'assign_lead'])
  action: string;

  @IsNotEmpty()
  @IsObject()
  actionConfig: Record<string, any>;

  @IsOptional()
  @IsObject()
  skipCondition?: Record<string, any>;
}

export class CreateWorkflowDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsEnum(['lead_created', 'status_changed', 'score_changed', 'conversation_ended', 'handoff_completed'])
  trigger: string;

  @IsOptional()
  @IsObject()
  triggerConditions?: Record<string, any>;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps: WorkflowStepDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
