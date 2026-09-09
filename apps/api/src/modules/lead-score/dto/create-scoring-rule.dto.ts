import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateScoringRuleDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsEnum([
    'field_match',
    'conversation_count',
    'message_count',
    'has_email',
    'has_phone',
    'page_visit',
    'sentiment_score',
    'keyword_match',
    'custom',
  ])
  condition: string;

  @IsOptional()
  @IsObject()
  conditionConfig?: Record<string, any>;

  @IsNotEmpty()
  @IsNumber()
  points: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;
}
