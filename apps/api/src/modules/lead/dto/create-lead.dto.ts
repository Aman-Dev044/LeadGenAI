import { IsArray, IsEmail, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { LEAD_STATUSES } from '../../../common/constants/pipeline';

export class CreateLeadDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsEnum(LEAD_STATUSES)
  status?: string;

  @IsOptional()
  @IsEnum(['hot', 'warm', 'cold'])
  temperature?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
