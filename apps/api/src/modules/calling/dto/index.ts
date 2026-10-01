import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CALL_OUTCOMES, CALL_STATUSES, CALL_TYPES } from '../../../schemas/call-log.schema';

export class CallQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(CALL_STATUSES)
  status?: string;

  @IsOptional()
  @IsEnum(CALL_OUTCOMES)
  outcome?: string;

  @IsOptional()
  @IsEnum(CALL_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class StartAiCallDto {
  /** Override the stored phone for this one call (e.g. an alternate number). */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  /** Dial now even outside calling hours. */
  @IsOptional()
  @IsBoolean()
  ignoreCallingHours?: boolean;
}

export class ClickToCallDto {
  /** The salesperson's own phone; defaults to the number on their profile. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  fromPhone?: string;
}

export class LogManualCallDto {
  @IsEnum(CALL_OUTCOMES)
  outcome: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  notes?: string;

  /** Pasted transcript, if the salesperson has one. */
  @IsOptional()
  @IsString()
  @MaxLength(30000)
  transcript?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(7200)
  durationSeconds?: number;

  /** When the lead asked to be called back. */
  @IsOptional()
  @IsDateString()
  callbackAt?: string;

  /** Let the AI read the notes and schedule the next step (default true). */
  @IsOptional()
  @IsBoolean()
  analyse?: boolean;
}

export class BulkAiCallDto {
  @IsString({ each: true })
  leadIds: string[];

  /** Start calling at this time instead of now (ISO). */
  @IsOptional()
  @IsDateString()
  at?: string;

  @IsOptional()
  @IsBoolean()
  ignoreCallingHours?: boolean;
}

export class UpdateCallingSettingsDto {
  @IsObject()
  settings: Record<string, any>;
}

export class TestCallDto {
  @IsString()
  @MaxLength(30)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}
