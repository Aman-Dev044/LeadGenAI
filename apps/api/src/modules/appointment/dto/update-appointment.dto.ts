import { IsDateString, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsEnum(['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'])
  status?: string;

  @IsOptional()
  @IsObject()
  attendee?: {
    name?: string;
    email?: string;
    phone?: string;
  };

  @IsOptional()
  @IsString()
  meetingLink?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  cancellationReason?: string;
}
