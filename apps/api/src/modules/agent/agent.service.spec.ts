import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { AgentService } from './agent.service';
import { CacheService } from '../../providers/redis/cache.service';

describe('AgentService', () => {
  let service: AgentService;
  let agentModel: any;

  const mockAgent = {
    _id: 'agent-id-123',
    tenantId: 'tenant-123',
    name: 'Sales Bot',
    description: 'A sales chatbot',
    welcomeMessage: 'Hello! How can I help you?',
    isActive: true,
    save: jest.fn(),
    toJSON: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: getModelToken('Agent'),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
            findOneAndUpdate: jest.fn(),
            create: jest.fn(),
            countDocuments: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    agentModel = module.get(getModelToken('Agent'));
  });

  describe('create', () => {
    it('should create a new agent', async () => {
      agentModel.create.mockResolvedValue(mockAgent);

      const result = await service.create('tenant-123', {
        name: 'Sales Bot',
        description: 'A sales chatbot',
        systemPrompt: 'You are a helpful sales assistant.',
        welcomeMessage: 'Hello!',
      });

      expect(result.name).toBe('Sales Bot');
    });
  });

  describe('findById', () => {
    it('should return agent by id', async () => {
      agentModel.findOne.mockResolvedValue(mockAgent);

      const result = await service.findById('tenant-123', 'agent-id-123');
      expect(result.name).toBe('Sales Bot');
    });

    it('should throw NotFoundException for missing agent', async () => {
      agentModel.findOne.mockResolvedValue(null);

      await expect(
        service.findById('tenant-123', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update agent fields', async () => {
      agentModel.findOneAndUpdate.mockResolvedValue({
        ...mockAgent,
        name: 'Updated Bot',
      });

      const result = await service.update('tenant-123', 'agent-id-123', {
        name: 'Updated Bot',
      });

      expect(result.name).toBe('Updated Bot');
    });

    it('should throw NotFoundException for missing agent', async () => {
      agentModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.update('tenant-123', 'nonexistent', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete (soft)', () => {
    it('should soft delete agent', async () => {
      agentModel.findOneAndUpdate.mockResolvedValue({
        ...mockAgent,
        deletedAt: new Date(),
      });

      const result = await service.remove('tenant-123', 'agent-id-123');
      expect(result).toBeDefined();
    });
  });

  describe('getPublicConfig', () => {
    it('should return public agent config without internal fields', async () => {
      const publicAgent = { ...mockAgent, tenantId: 'tenant-123', toObject: () => ({ ...mockAgent, tenantId: 'tenant-123' }) };
      agentModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(publicAgent) });

      const result = await service.getPublicConfig('agent-id-123');
      expect(result).toBeDefined();
      expect(result.name).toBe('Sales Bot');
    });

    it('should throw NotFoundException for inactive or deleted agent', async () => {
      agentModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await expect(service.getPublicConfig('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
