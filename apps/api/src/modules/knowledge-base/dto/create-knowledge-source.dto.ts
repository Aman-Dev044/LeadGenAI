import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateKnowledgeSourceDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(['file', 'url', 'text', 'sitemap'])
  type: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  rawContent?: string;
}
