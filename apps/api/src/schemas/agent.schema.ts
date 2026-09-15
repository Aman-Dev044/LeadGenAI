import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AgentDocument = HydratedDocument<Agent>;

@Schema({ timestamps: true })
export class Agent {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ required: true, type: String })
  systemPrompt: string;

  @Prop({ type: String })
  welcomeMessage: string;

  @Prop({
    type: {
      provider: { type: String, default: 'openai' },
      model: { type: String, default: 'gpt-4o-mini' },
      temperature: { type: Number, default: 0.7 },
      maxTokens: { type: Number, default: 1024 },
    },
    default: {},
  })
  aiConfig: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };

  @Prop({
    type: {
      primaryColor: String,
      headerText: String,
      placeholder: String,
      position: { type: String, default: 'bottom-right' },
      avatarUrl: String,
      whatsappEnabled: { type: Boolean, default: false },
      whatsappNumber: { type: String, default: '' },
      whatsappDefaultMessage: { type: String, default: '' },
      proactivePromptEnabled: { type: Boolean, default: true },
      proactiveDelaySeconds: { type: Number, default: 10 },
      proactiveMessage: { type: String, default: '' },
      exitIntentEnabled: { type: Boolean, default: true },
      exitIntentMessage: { type: String, default: '' },
      defaultVoiceName: { type: String, default: '' },
      defaultVoiceRate: { type: Number, default: 1.0 },
      defaultVoicePitch: { type: Number, default: 1.0 },
    },
    default: {},
  })
  widgetConfig: {
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

  @Prop({ type: [String], default: [] })
  enabledTools: string[];

  @Prop({
    type: [{
      field: String,
      label: String,
      type: { type: String, enum: ['text', 'email', 'phone', 'select', 'number'] },
      required: Boolean,
      options: [String],
      order: Number,
    }],
    default: [],
  })
  leadCaptureFields: {
    field: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
    order: number;
  }[];

  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      triggerKeywords: [String],
      assignTo: String,
      notifyChannels: [String],
    },
    default: {},
  })
  handoffConfig: {
    enabled: boolean;
    triggerKeywords: string[];
    assignTo?: string;
    notifyChannels: string[];
  };

  @Prop({
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'draft',
  })
  status: string;

  @Prop({ type: [String], default: [] })
  knowledgeSourceIds: string[];

  @Prop()
  deletedAt: Date;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);

AgentSchema.index({ tenantId: 1, status: 1 });
