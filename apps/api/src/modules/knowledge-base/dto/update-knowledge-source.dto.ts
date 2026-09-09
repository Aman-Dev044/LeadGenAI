import { IsOptional, IsString } from 'class-validator';

export class UpdateKnowledgeSourceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  rawContent?: string;
}
