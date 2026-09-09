import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { ChunkerService } from './chunker.service';
import { EmbeddingService } from './embedding.service';
import { STORAGE_PROVIDER } from '../../providers/storage/storage.module';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let sourceModel: any;
  let chunkModel: any;

  const mockSource = {
    _id: 'source-123',
    tenantId: 'tenant-123',
    name: 'Test Source',
    type: 'text',
    rawContent: 'Some test content for knowledge base.',
    status: 'pending',
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBaseService,
        {
          provide: getModelToken('KnowledgeSource'),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
            findOneAndUpdate: jest.fn(),
            create: jest.fn().mockResolvedValue(mockSource),
          },
        },
        {
          provide: getModelToken('KnowledgeChunk'),
          useValue: {
            deleteMany: jest.fn().mockResolvedValue({}),
            insertMany: jest.fn().mockResolvedValue([]),
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
              }),
            }),
          },
        },
        {
          provide: ChunkerService,
          useValue: {
            chunkByParagraph: jest.fn().mockReturnValue([
              { content: 'chunk 1', index: 0, tokenCount: 10 },
              { content: 'chunk 2', index: 1, tokenCount: 8 },
            ]),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]),
            generateEmbeddings: jest.fn().mockResolvedValue([[0.1], [0.2]]),
            searchSimilar: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: STORAGE_PROVIDER,
          useValue: {
            upload: jest.fn(),
            download: jest.fn().mockResolvedValue({
              body: Buffer.from('file content'),
              contentType: 'text/plain',
            }),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<KnowledgeBaseService>(KnowledgeBaseService);
    sourceModel = module.get(getModelToken('KnowledgeSource'));
    chunkModel = module.get(getModelToken('KnowledgeChunk'));
  });

  describe('createSource', () => {
    it('should create a knowledge source', async () => {
      const result = await service.createSource('tenant-123', {
        name: 'Test',
        type: 'text',
        rawContent: 'Content',
      });

      expect(result).toEqual(mockSource);
      expect(sourceModel.create).toHaveBeenCalled();
    });
  });

  describe('findSourceById', () => {
    it('should return a source by id', async () => {
      sourceModel.findOne.mockResolvedValue(mockSource);

      const result = await service.findSourceById('tenant-123', 'source-123');
      expect(result.name).toBe('Test Source');
    });

    it('should throw NotFoundException', async () => {
      sourceModel.findOne.mockResolvedValue(null);

      await expect(
        service.findSourceById('tenant-123', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSource', () => {
    it('should update a source', async () => {
      sourceModel.findOneAndUpdate.mockResolvedValue({
        ...mockSource,
        name: 'Updated',
      });

      const result = await service.updateSource('tenant-123', 'source-123', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException for missing source', async () => {
      sourceModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.updateSource('tenant-123', 'nonexistent', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSource', () => {
    it('should soft delete and remove chunks', async () => {
      sourceModel.findOneAndUpdate.mockResolvedValue(mockSource);

      const result = await service.deleteSource('tenant-123', 'source-123');

      expect(result.message).toBe('Knowledge source deleted');
      expect(chunkModel.deleteMany).toHaveBeenCalled();
    });
  });

  describe('searchKnowledge', () => {
    it('should search with embedding similarity', async () => {
      const embeddingService = (service as any).embeddingService;

      await service.searchKnowledge('tenant-123', 'test query');

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('test query');
      expect(embeddingService.searchSimilar).toHaveBeenCalled();
    });
  });
});
