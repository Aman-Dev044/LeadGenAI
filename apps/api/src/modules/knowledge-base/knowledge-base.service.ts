import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateKnowledgeSourceDto, UpdateKnowledgeSourceDto } from './dto';
import { ChunkerService } from './chunker.service';
import { EmbeddingService } from './embedding.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { escapeRegex } from '../../common/utils/sanitize';
import { IStorageProvider } from '../../common/interfaces';
import { STORAGE_PROVIDER } from '../../providers/storage/storage.module';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    @InjectModel('KnowledgeSource') private readonly sourceModel: Model<any>,
    @InjectModel('KnowledgeChunk') private readonly chunkModel: Model<any>,
    private readonly chunkerService: ChunkerService,
    private readonly embeddingService: EmbeddingService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: IStorageProvider,
  ) {}

  async createSource(tenantId: string, dto: CreateKnowledgeSourceDto) {
    const source = await this.sourceModel.create({
      tenantId,
      ...dto,
      status: 'pending',
    });

    // Process asynchronously
    this.processSource(source._id.toString(), tenantId).catch((err) => {
      this.logger.error(`Failed to process source ${source._id}: ${err.message}`);
    });

    return source;
  }

  async createFileSource(tenantId: string, name: string, file: Express.Multer.File) {
    const fileKey = `knowledge/${tenantId}/${Date.now()}-${file.originalname}`;
    const bucket = 'ai-lead-gen-uploads';

    // Upload to storage
    await this.storageProvider.upload({
      bucket,
      key: fileKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const source = await this.sourceModel.create({
      tenantId,
      name,
      type: 'file',
      fileKey,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      status: 'pending',
    });

    // Process asynchronously
    this.processSource(source._id.toString(), tenantId).catch((err) => {
      this.logger.error(`Failed to process file source ${source._id}: ${err.message}`);
    });

    return source;
  }

  async updateSource(tenantId: string, sourceId: string, dto: UpdateKnowledgeSourceDto) {
    const source = await this.sourceModel.findOneAndUpdate(
      { _id: sourceId, tenantId, deletedAt: null },
      { $set: dto },
      { new: true },
    );
    if (!source) {
      throw new NotFoundException('Knowledge source not found');
    }

    // If content or URL changed, reprocess
    if (dto.rawContent || dto.sourceUrl) {
      await this.chunkModel.deleteMany({ sourceId, tenantId });
      source.status = 'pending';
      source.chunkCount = 0;
      await source.save();

      this.processSource(sourceId, tenantId).catch((err) => {
        this.logger.error(`Failed to reprocess source ${sourceId}: ${err.message}`);
      });
    }

    return source;
  }

  async findAllSources(tenantId: string, paginationDto: PaginationDto) {
    const query: any = { tenantId, deletedAt: null };
    if (paginationDto.search) {
      query.name = { $regex: escapeRegex(paginationDto.search), $options: 'i' };
    }
    return paginate(this.sourceModel, query, paginationDto);
  }

  async findSourceById(tenantId: string, sourceId: string) {
    const source = await this.sourceModel.findOne({
      _id: sourceId,
      tenantId,
      deletedAt: null,
    });
    if (!source) {
      throw new NotFoundException('Knowledge source not found');
    }
    return source;
  }

  async deleteSource(tenantId: string, sourceId: string) {
    const source = await this.sourceModel.findOneAndUpdate(
      { _id: sourceId, tenantId },
      { deletedAt: new Date() },
      { new: true },
    );
    if (!source) {
      throw new NotFoundException('Knowledge source not found');
    }

    // Delete associated chunks
    await this.chunkModel.deleteMany({ sourceId, tenantId });

    return { message: 'Knowledge source deleted' };
  }

  async reprocessSource(tenantId: string, sourceId: string) {
    const source = await this.sourceModel.findOne({
      _id: sourceId,
      tenantId,
      deletedAt: null,
    });
    if (!source) {
      throw new NotFoundException('Knowledge source not found');
    }

    // Delete existing chunks
    await this.chunkModel.deleteMany({ sourceId, tenantId });

    // Reprocess
    source.status = 'pending';
    source.chunkCount = 0;
    await source.save();

    this.processSource(sourceId, tenantId).catch((err) => {
      this.logger.error(`Failed to reprocess source ${sourceId}: ${err.message}`);
    });

    return { message: 'Reprocessing started' };
  }

  async searchKnowledge(
    tenantId: string,
    query: string,
    sourceIds?: string[],
    limit = 5,
  ) {
    // Try semantic search with embeddings first
    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      const results = await this.embeddingService.searchSimilar(
        queryEmbedding,
        this.chunkModel,
        tenantId,
        sourceIds,
        limit,
      );
      if (results.length > 0) return results;
    } catch (err) {
      this.logger.warn(`Semantic search failed, falling back to keyword search: ${err.message}`);
    }

    // Fallback: keyword-based search using MongoDB regex
    return this.keywordFallbackSearch(tenantId, query, sourceIds, limit);
  }

  private async keywordFallbackSearch(
    tenantId: string,
    query: string,
    sourceIds?: string[],
    limit = 5,
  ): Promise<any[]> {
    const filter: any = { tenantId };
    if (sourceIds?.length) {
      filter.sourceId = { $in: sourceIds };
    }

    // Split query into keywords and search for any match
    const keywords = query
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => escapeRegex(w));

    if (keywords.length === 0) return [];

    const regexPattern = keywords.join('|');
    filter.content = { $regex: regexPattern, $options: 'i' };

    const chunks = await this.chunkModel
      .find(filter)
      .select('content metadata sourceId')
      .limit(limit)
      .lean();

    // Score by number of keyword matches
    return chunks.map((chunk: any) => {
      const matchCount = keywords.reduce((count, kw) => {
        const regex = new RegExp(kw, 'gi');
        const matches = (chunk.content || '').match(regex);
        return count + (matches ? matches.length : 0);
      }, 0);
      return {
        _id: chunk._id,
        content: chunk.content,
        metadata: chunk.metadata,
        sourceId: chunk.sourceId,
        score: matchCount / (keywords.length * 5), // normalize roughly 0-1
      };
    }).sort((a: any, b: any) => b.score - a.score);
  }

  private async processSource(sourceId: string, tenantId: string) {
    const source = await this.sourceModel.findById(sourceId);
    if (!source) return;

    try {
      source.status = 'processing';
      await source.save();

      let content = '';

      switch (source.type) {
        case 'text':
          content = source.rawContent || '';
          break;
        case 'url':
          content = await this.fetchUrlContent(source.sourceUrl);
          break;
        case 'file':
          content = await this.extractFileContent(source);
          break;
        case 'sitemap':
          content = await this.processSitemap(source.sourceUrl);
          break;
      }

      if (!content) {
        source.status = 'failed';
        source.errorMessage = 'No content to process';
        await source.save();
        return;
      }

      // Store raw content for future reference
      source.rawContent = content;

      // Chunk the content
      const chunks = this.chunkerService.chunkByParagraph(content);

      if (chunks.length === 0) {
        source.status = 'failed';
        source.errorMessage = 'No chunks generated';
        await source.save();
        return;
      }

      // Generate embeddings in batches
      const texts = chunks.map((c) => c.content);
      let embeddings: number[][] = [];
      let embeddingsFailed = false;

      try {
        embeddings = await this.embeddingService.generateEmbeddings(texts);
      } catch (embErr) {
        this.logger.warn(
          `Embedding generation failed for source ${sourceId}: ${embErr.message}. Storing chunks without embeddings.`,
        );
        embeddingsFailed = true;
        embeddings = texts.map(() => []);
      }

      // Save chunks (with or without embeddings)
      const chunkDocs = chunks.map((chunk, i) => ({
        tenantId,
        sourceId,
        content: chunk.content,
        embedding: embeddings[i],
        metadata: {
          sourceType: source.type,
          sourceName: source.name,
          chunkIndex: chunk.index,
        },
        tokenCount: chunk.tokenCount,
      }));

      await this.chunkModel.insertMany(chunkDocs);

      source.status = embeddingsFailed ? 'completed' : 'completed';
      source.chunkCount = chunks.length;
      source.lastProcessedAt = new Date();
      if (embeddingsFailed) {
        source.errorMessage = 'Chunks saved but embeddings failed - semantic search may not work. Check your OPENAI_API_KEY.';
      }
      await source.save();

      this.logger.log(
        `Processed source ${sourceId}: ${chunks.length} chunks created${embeddingsFailed ? ' (without embeddings)' : ''}`,
      );
    } catch (error) {
      source.status = 'failed';
      source.errorMessage = error.message;
      await source.save();
      this.logger.error(`Processing failed for source ${sourceId}`, error.stack);
    }
  }

  private async fetchUrlContent(url: string): Promise<string> {
    if (!url) return '';

    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AILeadGenBot/1.0)',
      },
      maxContentLength: 10 * 1024 * 1024, // 10MB limit
    });

    const $ = cheerio.load(response.data);

    // Remove scripts, styles, nav, footer
    $('script, style, nav, footer, header, aside, iframe, noscript').remove();

    // Extract text from main content areas
    const mainContent =
      $('main').text() || $('article').text() || $('body').text();

    return mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async extractFileContent(source: any): Promise<string> {
    if (!source.fileKey) return source.rawContent || '';

    const bucket = 'ai-lead-gen-uploads';
    const downloaded = await this.storageProvider.download(bucket, source.fileKey);
    const buffer = downloaded.body;
    const contentType = downloaded.contentType || '';

    if (contentType.includes('pdf') || source.fileKey.endsWith('.pdf')) {
      const pdfData = await pdfParse(buffer);
      return pdfData.text;
    }

    if (
      contentType.includes('wordprocessingml') ||
      source.fileKey.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    // Plain text, CSV, markdown, etc.
    return buffer.toString('utf-8');
  }

  private async processSitemap(sitemapUrl: string): Promise<string> {
    if (!sitemapUrl) return '';

    const response = await axios.get(sitemapUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AILeadGenBot/1.0)',
      },
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const urls: string[] = [];

    $('url > loc').each((_, el) => {
      urls.push($(el).text());
    });

    if (urls.length === 0) return '';

    // Crawl up to 20 pages from sitemap
    const pageLimit = Math.min(urls.length, 20);
    const contents: string[] = [];

    for (let i = 0; i < pageLimit; i++) {
      try {
        const pageContent = await this.fetchUrlContent(urls[i]);
        if (pageContent) {
          contents.push(`--- Page: ${urls[i]} ---\n${pageContent}`);
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch sitemap page ${urls[i]}: ${err.message}`);
      }
    }

    return contents.join('\n\n');
  }
}
