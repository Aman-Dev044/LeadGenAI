import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { SOCIAL_PLATFORMS } from '../../../schemas/social-campaign.schema';
import { OUTREACH_CHANNELS, POST_INTENTS } from '../../../schemas/social-post-lead.schema';
import { MESSAGE_LANGUAGES, MESSAGE_TONES } from '../../../schemas/social-campaign.schema';

export class ImportSocialPostsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  ids: string[];
}

export class RejectSocialPostsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  ids: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

/**
 * Query filters for the review queue. Extends PaginationDto because the global
 * ValidationPipe runs with `forbidNonWhitelisted`: two separate @Query() DTOs on
 * one handler would each reject the other's properties.
 */
export class SocialPostQueryDto extends PaginationDto {
  @IsOptional()
  @IsMongoId()
  campaignId?: string;

  @IsOptional()
  @IsIn(['new', 'reviewed', 'imported', 'rejected'])
  status?: string;

  @IsOptional()
  @IsIn(SOCIAL_PLATFORMS as unknown as string[])
  source?: string;

  @IsOptional()
  @IsIn(POST_INTENTS as unknown as string[])
  intent?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  country?: string;

  /** Only posts written in the last N days. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  withinDays?: number;
}

export class GenerateMessageDto {
  @IsOptional()
  @IsIn(OUTREACH_CHANNELS as unknown as string[])
  channel?: string;

  @IsOptional()
  @IsIn(MESSAGE_TONES as unknown as string[])
  tone?: string;

  @IsOptional()
  @IsIn(MESSAGE_LANGUAGES as unknown as string[])
  language?: string;
}

export class UpdateMessageDto {
  @IsString()
  @MaxLength(4000)
  body: string;
}

export class MarkSentDto {
  @IsOptional()
  @IsIn(OUTREACH_CHANNELS as unknown as string[])
  channel?: string;
}
