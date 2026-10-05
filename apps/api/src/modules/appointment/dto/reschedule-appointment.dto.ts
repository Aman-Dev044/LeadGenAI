import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsNotEmpty()
  @IsDateString()
  startTime: string;

  @IsNotEmpty()
  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Replaces the meeting title when the topic changed. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /** Replaces the agenda / notes when the topic changed. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
