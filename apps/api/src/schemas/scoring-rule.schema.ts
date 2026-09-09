import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ScoringRuleDocument = HydratedDocument<ScoringRule>;

@Schema({ timestamps: true })
export class ScoringRule {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description: string;

  @Prop({
    type: String,
    enum: [
      'field_match',
      'conversation_count',
      'message_count',
      'has_email',
      'has_phone',
      'page_visit',
      'sentiment_score',
      'keyword_match',
      'custom',
    ],
    required: true,
  })
  condition: string;

  @Prop({ type: Object, default: {} })
  conditionConfig: Record<string, any>;

  @Prop({ required: true, type: Number })
  points: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  order: number;
}

export const ScoringRuleSchema = SchemaFactory.createForClass(ScoringRule);

ScoringRuleSchema.index({ tenantId: 1, isActive: 1 });
