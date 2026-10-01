import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ImportScrapedLeadsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  ids: string[];
}

export class RejectScrapedLeadsDto {
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
 * Query filters for the results table. Extends PaginationDto because the global
 * ValidationPipe runs with `forbidNonWhitelisted`: two separate @Query() DTOs on
 * one handler would each reject the other's properties.
 */
export class ScrapedLeadQueryDto extends PaginationDto {
  @IsOptional()
  @IsMongoId()
  campaignId?: string;

  @IsOptional()
  @IsIn(['new', 'reviewed', 'imported', 'rejected'])
  status?: string;

  // `Boolean('false')` is true, so parse the string explicitly.
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  @IsBoolean()
  isNewListing?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;
}
