import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type KnowledgeSourceDocument = HydratedDocument<KnowledgeSource>;

@Schema({ timestamps: true })
export class KnowledgeSource {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: ['file', 'url', 'text', 'sitemap'],
    required: true,
  })
  type: string;

  @Prop({
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: String })
  sourceUrl: string;

  @Prop({ type: String })
  fileKey: string;

  @Prop({ type: String })
  fileName: string;

  @Prop({ type: String })
  mimeType: string;

  @Prop({ type: Number })
  fileSize: number;

  @Prop({ type: String })
  rawContent: string;

  @Prop({ default: 0 })
  chunkCount: number;

  @Prop({ type: String })
  errorMessage: string;

  @Prop()
  lastProcessedAt: Date;

  @Prop()
  deletedAt: Date;
}

export const KnowledgeSourceSchema = SchemaFactory.createForClass(KnowledgeSource);

KnowledgeSourceSchema.index({ tenantId: 1, status: 1 });
