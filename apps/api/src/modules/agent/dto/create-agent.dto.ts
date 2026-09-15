import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAgentDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  systemPrompt: string;

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
  leadCaptureFields?: {
    field: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
    order: number;
  }[];

  @IsOptional()
  @IsObject()
  handoffConfig?: {
    enabled: boolean;
    triggerKeywords?: string[];
    assignTo?: string;
    notifyChannels?: string[];
  };

  @IsOptional()
  @IsEnum(['active', 'inactive', 'draft'])
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeSourceIds?: string[];
}
