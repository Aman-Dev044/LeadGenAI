import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LeadFieldDocument = HydratedDocument<LeadField>;

@Schema({ timestamps: true })
export class LeadField {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({
    type: String,
    enum: ['text', 'number', 'email', 'phone', 'date', 'select', 'multiselect', 'boolean', 'url'],
    required: true,
  })
  type: string;

  @Prop({ default: false })
  required: boolean;

  @Prop({ type: [String], default: [] })
  options: string[];

  @Prop({ type: String })
  defaultValue: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const LeadFieldSchema = SchemaFactory.createForClass(LeadField);

LeadFieldSchema.index({ tenantId: 1, name: 1 }, { unique: true });
