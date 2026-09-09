import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedOrigins?: string[];

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsObject()
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };

  @IsOptional()
  @IsObject()
  settings?: {
    aiProvider?: string;
    aiModel?: string;
    timezone?: string;
    language?: string;
  };

  @IsOptional()
  @IsObject()
  assignmentSettings?: {
    enabled?: boolean;
    strategy?: 'round_robin' | 'least_loaded';
    roles?: string[];
    rules?: { field: string; operator: string; value?: any; assignTo: string }[];
    fallbackUserId?: string;
    assignHandoffs?: boolean;
  };

  @IsOptional()
  @IsObject()
  notificationSettings?: {
    emailOnNewLead?: boolean;
    emailOnHotLead?: boolean;
    emailOnHandoff?: boolean;
    slackWebhookUrl?: string;
    teamsWebhookUrl?: string;
    notifyRoles?: string[];
  };
}
