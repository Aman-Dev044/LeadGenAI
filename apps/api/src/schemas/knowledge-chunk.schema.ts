import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type KnowledgeChunkDocument = HydratedDocument<KnowledgeChunk>;

@Schema({ timestamps: true })
export class KnowledgeChunk {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  sourceId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [Number], default: [] })
  embedding: number[];

  @Prop({
    type: {
      sourceType: String,
      sourceName: String,
      pageNumber: Number,
      chunkIndex: Number,
      url: String,
    },
    default: {},
  })
  metadata: {
    sourceType?: string;
    sourceName?: string;
    pageNumber?: number;
    chunkIndex?: number;
    url?: string;
  };

  @Prop({ default: 0 })
  tokenCount: number;
}

export const KnowledgeChunkSchema = SchemaFactory.createForClass(KnowledgeChunk);

KnowledgeChunkSchema.index({ tenantId: 1, sourceId: 1 });
// Note: Create Atlas Vector Search index via Atlas UI or CLI for semantic search
