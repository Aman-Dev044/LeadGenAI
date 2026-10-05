import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WhatsAppMediaDocument = HydratedDocument<WhatsAppMedia>;

/**
 * A workspace's media library for WhatsApp: brochures, package photos,
 * price lists, sample itineraries. The AI picks from these by title and
 * description and attaches them to its replies.
 */
@Schema({ timestamps: true })
export class WhatsAppMedia {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  title: string;

  /** What is in the file, so the AI knows when to send it. */
  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  /** Object key in the storage bucket. */
  @Prop({ required: true })
  storageKey: string;

  @Prop({ type: String })
  mimeType: string;

  @Prop({ type: Number, default: 0 })
  size: number;

  @Prop({ type: String })
  uploadedBy: string;

  @Prop({ type: Number, default: 0 })
  sentCount: number;
}

export const WhatsAppMediaSchema = SchemaFactory.createForClass(WhatsAppMedia);
WhatsAppMediaSchema.index({ tenantId: 1, createdAt: -1 });
