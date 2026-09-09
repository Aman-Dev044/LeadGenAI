import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { FollowUpService } from './follow-up.service';
import { NotificationService } from '../notification/notification.service';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../../common/events';

describe('FollowUpService', () => {
  let service: FollowUpService;
  let workflowModel: any;
  let logModel: any;
  let leadModel: any;
  let notificationService: any;

  const mockWorkflow = {
    _id: 'workflow-123',
    tenantId: 'tenant-123',
    name: 'New Lead Follow-up',
    trigger: 'lead_created',
    isActive: true,
    steps: [
      { order: 1, action: 'send_email', delayMinutes: 0, actionConfig: { subject: 'Welcome' } },
      { order: 2, action: 'notify_salesperson', delayMinutes: 30, actionConfig: {} },
    ],
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpService,
        {
          provide: getModelToken('FollowUpWorkflow'),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
            create: jest.fn().mockResolvedValue(mockWorkflow),
          },
        },
        {
          provide: getModelToken('FollowUpLog'),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn().mockResolvedValue(null),
            exists: jest.fn().mockResolvedValue(null),
            insertMany: jest.fn().mockResolvedValue([]),
            updateMany: jest.fn().mockResolvedValue({}),
            updateOne: jest.fn().mockResolvedValue({}),
            create: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: getModelToken('Lead'),
          useValue: {
            findById: jest.fn(),
            findOne: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        {
          provide: getModelToken('LeadActivity'),
          useValue: { create: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: NotificationService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
            notifyTenant: jest.fn().mockResolvedValue([]),
            sendToLead: jest.fn().mockResolvedValue({ _id: 'n1' }),
          },
        },
        EventBusService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<FollowUpService>(FollowUpService);
    workflowModel = module.get(getModelToken('FollowUpWorkflow'));
    logModel = module.get(getModelToken('FollowUpLog'));
    leadModel = module.get(getModelToken('Lead'));
    notificationService = module.get(NotificationService);
  });

  describe('createWorkflow', () => {
    it('should create a workflow', async () => {
      const result = await service.createWorkflow('tenant-123', {
        name: 'New Lead Follow-up',
        trigger: 'lead_created',
        steps: [],
      } as any);

      expect(result.name).toBe('New Lead Follow-up');
    });
  });

  describe('findWorkflowById', () => {
    it('should return workflow', async () => {
      workflowModel.findOne.mockResolvedValue(mockWorkflow);

      const result = await service.findWorkflowById('tenant-123', 'workflow-123');
      expect(result.name).toBe('New Lead Follow-up');
    });

    it('should throw NotFoundException', async () => {
      workflowModel.findOne.mockResolvedValue(null);

      await expect(
        service.findWorkflowById('tenant-123', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteWorkflow', () => {
    it('should soft delete workflow', async () => {
      workflowModel.findOneAndUpdate.mockResolvedValue({
        ...mockWorkflow,
        deletedAt: new Date(),
        isActive: false,
      });

      const result = await service.deleteWorkflow('tenant-123', 'workflow-123');
      expect(result.message).toBe('Workflow deleted');
    });
  });

  describe('toggleStatus', () => {
    it('should toggle workflow active status', async () => {
      workflowModel.findOneAndUpdate.mockResolvedValue({
        ...mockWorkflow,
        isActive: false,
      });

      const result = await service.toggleStatus('tenant-123', 'workflow-123', false);
      expect(result.isActive).toBe(false);
    });
  });

  describe('triggerWorkflows', () => {
    it('should trigger matching workflows and queue one log per step', async () => {
      workflowModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([mockWorkflow]) });

      const lead = { _id: 'lead-1', firstName: 'Jane', email: 'jane@test.com', assignedTo: 'user-1' };

      await service.triggerWorkflows('tenant-123', 'lead_created', lead);

      expect(logModel.insertMany).toHaveBeenCalledTimes(1);
      const queued = logModel.insertMany.mock.calls[0][0];
      expect(queued).toHaveLength(2); // 2 steps
      expect(queued[0].status).toBe('pending');
      expect(queued[1].scheduledAt.getTime()).toBeGreaterThan(queued[0].scheduledAt.getTime());
    });

    it('should skip workflows that do not match conditions', async () => {
      workflowModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ ...mockWorkflow, triggerConditions: { status: 'qualified' } }]),
      });

      logModel.insertMany.mockClear();

      const lead = { _id: 'lead-1', status: 'new' };
      await service.triggerWorkflows('tenant-123', 'lead_created', lead);

      expect(logModel.insertMany).not.toHaveBeenCalled();
    });

    it('should not re-queue a workflow that is still in flight for the lead', async () => {
      workflowModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([mockWorkflow]) });
      logModel.exists.mockResolvedValueOnce({ _id: 'existing' });
      logModel.insertMany.mockClear();

      await service.triggerWorkflows('tenant-123', 'lead_created', { _id: 'lead-1' });

      expect(logModel.insertMany).not.toHaveBeenCalled();
    });
  });

  describe('processDueSteps', () => {
    it('should claim due logs and execute the step action', async () => {
      const log = { _id: 'log-1', tenantId: 'tenant-123', workflowId: 'workflow-123', leadId: 'lead-1', stepOrder: 2, action: 'notify_salesperson' };
      logModel.findOneAndUpdate.mockResolvedValueOnce(log).mockResolvedValueOnce(null);
      workflowModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockWorkflow) });
      leadModel.findOne.mockResolvedValue({ _id: 'lead-1', firstName: 'Jane', email: 'jane@test.com', assignedTo: 'user-1', save: jest.fn() });

      const processed = await service.processDueSteps();

      expect(processed).toBe(1);
      expect(notificationService.notifyTenant).toHaveBeenCalled();
      expect(logModel.updateOne).toHaveBeenCalledWith({ _id: 'log-1' }, expect.objectContaining({ $set: expect.objectContaining({ status: 'executed' }) }));
    });

    it('should send follow-up emails to the lead by default', async () => {
      const log = { _id: 'log-2', tenantId: 'tenant-123', workflowId: 'workflow-123', leadId: 'lead-1', stepOrder: 1, action: 'send_email' };
      logModel.findOneAndUpdate.mockResolvedValueOnce(log).mockResolvedValueOnce(null);
      workflowModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockWorkflow) });
      leadModel.findOne.mockResolvedValue({ _id: 'lead-1', firstName: 'Jane', email: 'jane@test.com', save: jest.fn() });

      await service.processDueSteps();

      expect(notificationService.sendToLead).toHaveBeenCalledWith('tenant-123', 'email', expect.objectContaining({ _id: 'lead-1' }), expect.objectContaining({ type: 'follow_up' }));
    });
  });
});
