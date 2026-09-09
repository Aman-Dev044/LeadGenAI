import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { LeadService } from './lead.service';
import { EventBusService } from '../../common/events';

describe('LeadService', () => {
  let service: LeadService;
  let leadModel: any;
  let leadActivityModel: any;

  const mockLead = {
    _id: 'lead-id-123',
    tenantId: 'tenant-123',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    phone: '+1234567890',
    status: 'new',
    score: 50,
    temperature: 'warm',
    source: 'widget',
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadService,
        {
          provide: getModelToken('Lead'),
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
          provide: getModelToken('LeadActivity'),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            insertMany: jest.fn(),
          },
        },
        {
          provide: getModelToken('Conversation'),
          useValue: { updateOne: jest.fn().mockResolvedValue({}) },
        },
        EventBusService,
      ],
    }).compile();

    service = module.get<LeadService>(LeadService);
    leadModel = module.get(getModelToken('Lead'));
    leadActivityModel = module.get(getModelToken('LeadActivity'));
  });

  describe('create', () => {
    it('should create a new lead', async () => {
      leadModel.create.mockResolvedValue(mockLead);
      leadActivityModel.create.mockResolvedValue({});

      const result = await service.create('tenant-123', {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
      });

      expect(result).toEqual(mockLead);
      expect(leadModel.create).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return a lead by id', async () => {
      leadModel.findOne.mockResolvedValue(mockLead);

      const result = await service.findById('tenant-123', 'lead-id-123');
      expect(result.email).toBe('jane@example.com');
    });

    it('should throw NotFoundException for non-existent lead', async () => {
      leadModel.findOne.mockResolvedValue(null);

      await expect(
        service.findById('tenant-123', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a lead', async () => {
      const updatedLead = { ...mockLead, firstName: 'Updated' };
      leadModel.findOne.mockResolvedValue(mockLead);
      leadModel.findOneAndUpdate.mockResolvedValue(updatedLead);
      leadActivityModel.create.mockResolvedValue({});

      const result = await service.update('tenant-123', 'lead-id-123', {
        firstName: 'Updated',
      });

      expect(result.firstName).toBe('Updated');
    });

    it('should throw NotFoundException for non-existent lead', async () => {
      leadModel.findOne.mockResolvedValue(null);
      leadModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.update('tenant-123', 'nonexistent', { firstName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('captureFromWidget', () => {
    it('should capture lead from widget with source set to widget', async () => {
      leadModel.findOne.mockResolvedValue(null); // no existing lead
      leadModel.create.mockResolvedValue({
        ...mockLead,
        source: 'widget',
      });
      leadActivityModel.create.mockResolvedValue({});

      const result = await service.captureFromWidget('tenant-123', {
        firstName: 'Jane',
        email: 'jane@example.com',
        source: 'widget',
      });

      expect(result.source).toBe('widget');
    });
  });
});
