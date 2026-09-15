import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @IsOptional()
  @IsObject()
  aiConfig?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };

  @IsOptional()
  @IsObject()
  widgetConfig?: {
    primaryColor?: string;
    headerText?: string;
    placeholder?: string;
    position?: string;
    avatarUrl?: string;
    whatsappEnabled?: boolean;
    whatsappNumber?: string;
    whatsappDefaultMessage?: string;
    proactivePromptEnabled?: boolean;
    proactiveDelaySeconds?: number;
    proactiveMessage?: string;
    exitIntentEnabled?: boolean;
    exitIntentMessage?: string;
    defaultVoiceName?: string;
    defaultVoiceRate?: number;
    defaultVoicePitch?: number;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledTools?: string[];

  @IsOptional()
  @IsArray()
  leadCaptureFields?: any[];

  @IsOptional()
  @IsObject()
  handoffConfig?: any;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'draft'])
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeSourceIds?: string[];
}
