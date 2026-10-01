import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from '../../../schemas/follow-up-task.schema';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  leadId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(TASK_TYPES)
  type?: string;

  @IsOptional()
  @IsEnum(TASK_PRIORITIES)
  priority?: string;

  @IsNotEmpty()
  @IsDateString()
  dueAt: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(TASK_TYPES)
  type?: string;

  @IsOptional()
  @IsEnum(TASK_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}

export class CompleteTaskDto {
  /** reached | no_answer | meeting_set | not_interested | won | lost | note */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  outcome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  /** Optionally schedule the next touch straight away. */
  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nextTitle?: string;

  @IsOptional()
  @IsEnum(TASK_TYPES)
  nextType?: string;

  /** Skip instead of complete (lead unreachable / no longer relevant). */
  @IsOptional()
  @IsBoolean()
  skipped?: boolean;
}

export class TaskQueryDto {
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
  @IsEnum(TASK_STATUSES)
  status?: string;

  /** overdue | today | upcoming | all */
  @IsOptional()
  @IsString()
  window?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  /** Only the caller's own tasks (default for salespeople). */
  @IsOptional()
  @IsBoolean()
  mine?: boolean;
}
