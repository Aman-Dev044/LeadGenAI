import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SERVICE_TYPES } from '../../../schemas/scraping-campaign.schema';
import {
  MESSAGE_LANGUAGES,
  MESSAGE_TONES,
  SOCIAL_PLATFORMS,
} from '../../../schemas/social-campaign.schema';

export class SocialFiltersDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  maxAgeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  minBodyLength?: number;

  @IsOptional()
  @IsBoolean()
  excludeNsfw?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  minEngagement?: number;

  @IsOptional()
  @IsBoolean()
  excludeSellers?: boolean;

  @IsOptional()
  @IsBoolean()
  strictCountry?: boolean;
}

export class SocialAiDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @IsBoolean()
  generateMessage?: boolean;

  @IsOptional()
  @IsIn(MESSAGE_TONES as unknown as string[])
  messageTone?: string;

  @IsOptional()
  @IsIn(MESSAGE_LANGUAGES as unknown as string[])
  messageLanguage?: string;
}

export class SocialScheduleDto {
  @IsOptional()
  @IsIn(['manual', 'daily', 'weekly'])
  mode?: 'manual' | 'daily' | 'weekly';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  hourUtc?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;
}

export class CreateSocialCampaignDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsIn(SERVICE_TYPES as unknown as string[], { each: true })
  serviceTypes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(SOCIAL_PLATFORMS as unknown as string[], { each: true })
  platforms?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  negativeKeywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  subreddits?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  siteFilters?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  extraQueries?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  languageCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  regionCode?: string;

  /** ISO 3166-1 alpha-2 codes. Empty means "anywhere". */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(/^[A-Za-z]{2}$/, { each: true, message: 'regionCodes must be ISO alpha-2 country codes' })
  regionCodes?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialFiltersDto)
  filters?: SocialFiltersDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialAiDto)
  ai?: SocialAiDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialScheduleDto)
  schedule?: SocialScheduleDto;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  maxResultsPerRun?: number;

  @IsOptional()
  @IsBoolean()
  autoImport?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  autoImportMinScore?: number;

  @IsOptional()
  @IsIn(['active', 'paused'])
  status?: string;
}

export class UpdateSocialCampaignDto extends CreateSocialCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  declare name: string;
}

export class PreviewSocialQueriesDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  serviceTypes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(SOCIAL_PLATFORMS as unknown as string[], { each: true })
  platforms?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  subreddits?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  siteFilters?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  extraQueries?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  maxAgeDays?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(/^[A-Za-z]{2}$/, { each: true })
  regionCodes?: string[];
}

export class SuggestKeywordsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsIn(SERVICE_TYPES as unknown as string[], { each: true })
  serviceTypes?: string[];
}
