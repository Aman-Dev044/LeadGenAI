import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { EmailChannel } from './channels/email-channel';
import { InAppChannel } from './channels/in-app-channel';
import { SlackChannel } from './channels/slack-channel';
import { SmsChannel } from './channels/sms-channel';
import { WhatsAppChannel } from './channels/whatsapp-channel';
import { TeamsChannel } from './channels/teams-channel';
import { PushChannel } from './channels/push-channel';
import { NotificationGateway } from '../../gateways/notification.gateway';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationModel: any;
  let userModel: any;

  const mockNotification = {
    _id: 'notif-1',
    tenantId: 'tenant-123',
    userId: 'user-1',
    title: 'Test Notification',
    body: 'Test body',
    channel: 'in_app',
    status: 'pending',
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getModelToken('Notification'),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue([mockNotification]),
                }),
              }),
            }),
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
            create: jest.fn().mockResolvedValue(mockNotification),
            insertMany: jest.fn().mockResolvedValue([mockNotification]),
            countDocuments: jest.fn().mockResolvedValue(5),
            updateMany: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
          },
        },
        {
          provide: getModelToken('User'),
          useValue: {
            findById: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({ _id: 'user-1', email: 'test@test.com', phone: '+1234567890' }),
              }),
            }),
            findOne: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({ _id: 'user-1', email: 'test@test.com', role: 'ADMIN' }),
              }),
            }),
            // No role-based recipients in the test tenant
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
              }),
            }),
          },
        },
        {
          provide: getModelToken('Tenant'),
          useValue: {
            findById: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({ notificationSettings: { emailOnNewLead: false } }),
              }),
            }),
          },
        },
        {
          provide: NotificationGateway,
          useValue: { sendToUser: jest.fn(), sendToTenant: jest.fn() },
        },
        {
          provide: EmailChannel,
          useValue: { send: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: InAppChannel,
          useValue: { send: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: SlackChannel,
          useValue: { send: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: SmsChannel,
          useValue: { send: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: WhatsAppChannel,
          useValue: { send: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: TeamsChannel,
          useValue: { send: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: PushChannel,
          useValue: { send: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationModel = module.get(getModelToken('Notification'));
    userModel = module.get(getModelToken('User'));
  });

  describe('create', () => {
    it('should create a notification and dispatch', async () => {
      const result = await service.create('tenant-123', {
        userId: 'user-1',
        title: 'Test',
        body: 'Test body',
        type: 'system',
        channel: 'in_app',
      });

      expect(result).toEqual(mockNotification);
      expect(notificationModel.create).toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('should return notifications for a user', async () => {
      const result = await service.findByUser('tenant-123', 'user-1');
      expect(result).toHaveLength(1);
    });

    it('should filter unread only', async () => {
      await service.findByUser('tenant-123', 'user-1', true);
      expect(notificationModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ readAt: null }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      notificationModel.findOneAndUpdate.mockResolvedValue({
        ...mockNotification,
        status: 'read',
        readAt: new Date(),
      });

      const result = await service.markAsRead('tenant-123', 'notif-1', 'user-1');
      expect(result.status).toBe('read');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      const result = await service.markAllAsRead('tenant-123', 'user-1');
      expect(result.message).toBe('All notifications marked as read');
      expect(notificationModel.updateMany).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const result = await service.getUnreadCount('tenant-123', 'user-1');
      expect(result.count).toBe(5);
    });
  });

  describe('notifyNewLead', () => {
    it('should create in_app notification for assigned user', async () => {
      await service.notifyNewLead(
        'tenant-123',
        { _id: 'lead-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' },
        'user-1',
      );

      expect(notificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'new_lead',
          channel: 'in_app',
        }),
      );
    });

    it('should fall back to role-based recipients when no assignedTo (none configured here)', async () => {
      notificationModel.create.mockClear();
      await service.notifyNewLead('tenant-123', { _id: 'lead-1' });
      expect(userModel.find).toHaveBeenCalled();
      expect(notificationModel.create).not.toHaveBeenCalled();
    });
  });
});
