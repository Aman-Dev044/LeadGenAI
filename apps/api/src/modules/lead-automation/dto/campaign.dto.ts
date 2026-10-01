import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SERVICE_TYPES } from '../../../schemas/scraping-campaign.schema';

export class CampaignFiltersDto {
  @IsOptional()
  @IsBoolean()
  onlyNewListings?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  maxReviewCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  newListingMaxAgeDays?: number;

  @IsOptional()
  @IsBoolean()
  requireNoWebsite?: boolean;

  @IsOptional()
  @IsBoolean()
  requirePhone?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsBoolean()
  operationalOnly?: boolean;
}

export class CampaignAiDto {
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
  generateOutreach?: boolean;
}

export class CampaignScheduleDto {
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

export class CreateCampaignDto {
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
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  businessCategories?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  locations?: string[];

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

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignFiltersDto)
  filters?: CampaignFiltersDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignAiDto)
  aiQualification?: CampaignAiDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignScheduleDto)
  schedule?: CampaignScheduleDto;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(200)
  maxResultsPerRun?: number;

  @IsOptional()
  @IsBoolean()
  autoImport?: boolean;

  @IsOptional()
  @IsIn(['active', 'paused'])
  status?: string;
}

export class UpdateCampaignDto extends CreateCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  declare name: string;
}

export class PreviewQueriesDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  serviceTypes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  businessCategories?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  locations?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  extraQueries?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2)
  regionCode?: string;
}
