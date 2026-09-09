import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { ChunkerService } from './chunker.service';
import { EmbeddingService } from './embedding.service';
import { KnowledgeSourceSchema } from '../../schemas/knowledge-source.schema';
import { KnowledgeChunkSchema } from '../../schemas/knowledge-chunk.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'KnowledgeSource', schema: KnowledgeSourceSchema },
      { name: 'KnowledgeChunk', schema: KnowledgeChunkSchema },
    ]),
  ],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService, ChunkerService, EmbeddingService],
  exports: [KnowledgeBaseService, EmbeddingService],
})
export class KnowledgeBaseModule {}
