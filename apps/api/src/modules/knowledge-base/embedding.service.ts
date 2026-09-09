import { Injectable, Logger } from '@nestjs/common';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(private readonly aiFactory: AIProviderFactory) {}

  async generateEmbedding(text: string): Promise<number[]> {
    const provider = this.aiFactory.getProvider('openai'); // always use openai for embeddings
    const result = await provider.generateEmbedding(text);
    return result.embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const provider = this.aiFactory.getProvider('openai');
    const batchSize = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const results = await provider.generateEmbeddings(batch);
      allEmbeddings.push(...results.map((r) => r.embedding));
    }

    return allEmbeddings;
  }

  async searchSimilar(
    queryEmbedding: number[],
    model: any,
    tenantId: string,
    sourceIds?: string[],
    limit = 5,
  ): Promise<any[]> {
    // Try Atlas $vectorSearch first, fall back to in-memory cosine similarity
    try {
      return await this.atlasVectorSearch(queryEmbedding, model, tenantId, sourceIds, limit);
    } catch (err) {
      this.logger.warn(`Atlas $vectorSearch not available, using in-memory cosine fallback: ${err.message}`);
      return this.cosineFallbackSearch(queryEmbedding, model, tenantId, sourceIds, limit);
    }
  }

  private async atlasVectorSearch(
    queryEmbedding: number[],
    model: any,
    tenantId: string,
    sourceIds?: string[],
    limit = 5,
  ): Promise<any[]> {
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit: limit,
          filter: {
            tenantId: tenantId,
            ...(sourceIds?.length ? { sourceId: { $in: sourceIds } } : {}),
          },
        },
      },
      {
        $project: {
          content: 1,
          metadata: 1,
          sourceId: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    return model.aggregate(pipeline);
  }

  private async cosineFallbackSearch(
    queryEmbedding: number[],
    model: any,
    tenantId: string,
    sourceIds?: string[],
    limit = 5,
  ): Promise<any[]> {
    const filter: any = { tenantId };
    if (sourceIds?.length) {
      filter.sourceId = { $in: sourceIds };
    }

    // Fetch chunks that have embeddings
    const chunks = await model
      .find(filter)
      .select('content embedding metadata sourceId')
      .lean();

    if (chunks.length === 0) return [];

    // Compute cosine similarity for each chunk
    const scored = chunks
      .filter((chunk: any) => chunk.embedding?.length > 0)
      .map((chunk: any) => ({
        _id: chunk._id,
        content: chunk.content,
        metadata: chunk.metadata,
        sourceId: chunk.sourceId,
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
      }));

    // Sort by score descending, return top results
    scored.sort((a: any, b: any) => b.score - a.score);

    return scored.slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }
}
