import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { PlanExpiryReminderService } from './plan-expiry-reminder.service';
import { EMAIL_PROVIDER } from '../../providers/email/email.module';
import { NotificationService } from '../notification/notification.service';

const DAY = 24 * 60 * 60 * 1000;
const lean = (value: any) => ({ lean: jest.fn().mockResolvedValue(value), select: jest.fn().mockReturnThis() });

describe('PlanExpiryReminderService', () => {
  let service: PlanExpiryReminderService;
  let tenantModel: any;
  let subscriptionModel: any;
  let userModel: any;
  let emailProvider: any;
  let notificationService: any;

  const trialTenant = { _id: 't1', name: 'Acme', slug: 'acme', plan: 'free', status: 'trial', trialEndsAt: new Date(Date.now() + 3 * DAY) };
  const paidTenant = { _id: 't2', name: 'Globex', slug: 'globex', plan: 'starter', status: 'active' };
  const admin = { _id: 'u1', email: 'admin@acme.com', firstName: 'Ann' };

  beforeEach(async () => {
    delete process.env.PLAN_REMINDER_DAYS_BEFORE;
    const module = await Test.createTestingModule({
      providers: [
        PlanExpiryReminderService,
        { provide: getModelToken('Tenant'), useValue: { find: jest.fn(), updateOne: jest.fn() } },
        { provide: getModelToken('Subscription'), useValue: { find: jest.fn() } },
        { provide: getModelToken('User'), useValue: { find: jest.fn() } },
        { provide: EMAIL_PROVIDER, useValue: { sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'm' }) } },
        { provide: NotificationService, useValue: { create: jest.fn().mockResolvedValue({}) } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://app.test') } },
      ],
    }).compile();

    service = module.get(PlanExpiryReminderService);
    tenantModel = module.get(getModelToken('Tenant'));
    subscriptionModel = module.get(getModelToken('Subscription'));
    userModel = module.get(getModelToken('User'));
    emailProvider = module.get(EMAIL_PROVIDER);
    notificationService = module.get(NotificationService);
  });

  it('finds trials and paid subscriptions ending inside the 7-day window', async () => {
    const sub = { tenantId: 't2', plan: 'starter', status: 'active', priceMonthly: 1999, currentPeriodEnd: new Date(Date.now() + 6 * DAY) };
    tenantModel.find.mockReturnValueOnce(lean([trialTenant])).mockReturnValueOnce(lean([paidTenant]));
    subscriptionModel.find.mockReturnValue(lean([sub]));

    const now = new Date();
    const candidates = await service.findCandidates(now);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({ kind: 'trial', plan: 'free', expiresAt: trialTenant.trialEndsAt });
    expect(candidates[1]).toMatchObject({ kind: 'subscription', plan: 'starter', expiresAt: sub.currentPeriodEnd });

    const trialQuery = tenantModel.find.mock.calls[0][0];
    expect(trialQuery.status).toBe('trial');
    expect(trialQuery.trialEndsAt.$gt).toBe(now);
    expect(trialQuery.trialEndsAt.$lte.getTime() - now.getTime()).toBe(7 * DAY);
    expect(subscriptionModel.find.mock.calls[0][0].priceMonthly).toEqual({ $gt: 0 });
  });

  it('emails and in-app notifies every tenant admin once per expiry', async () => {
    tenantModel.find.mockReturnValueOnce(lean([trialTenant])).mockReturnValueOnce(lean([]));
    subscriptionModel.find.mockReturnValue(lean([]));
    tenantModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
    userModel.find.mockReturnValue(lean([admin, { _id: 'u2', email: 'boss@acme.com', firstName: 'Bo' }]));

    const result = await service.runOnce();

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(tenantModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 't1', $or: expect.arrayContaining([{ 'renewalReminder.expiresAt': { $ne: trialTenant.trialEndsAt } }]) }),
      { $set: expect.objectContaining({ renewalReminder: expect.objectContaining({ kind: 'trial', expiresAt: trialTenant.trialEndsAt }) }) },
    );
    expect(userModel.find).toHaveBeenCalledWith({ tenantId: 't1', role: 'ADMIN', isActive: true, deletedAt: null });
    expect(emailProvider.sendEmail).toHaveBeenCalledTimes(2);
    expect(emailProvider.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@acme.com', subject: expect.stringContaining('Your trial ends in 3 days'), html: expect.stringContaining('http://app.test/dashboard/billing') }),
    );
    expect(notificationService.create).toHaveBeenCalledTimes(2);
    expect(notificationService.create).toHaveBeenCalledWith('t1', expect.objectContaining({ userId: 'u1', type: 'billing', channel: 'in_app' }));
  });

  it('skips an expiry that was already reminded about', async () => {
    tenantModel.find.mockReturnValueOnce(lean([trialTenant])).mockReturnValueOnce(lean([]));
    subscriptionModel.find.mockReturnValue(lean([]));
    tenantModel.updateOne.mockResolvedValue({ modifiedCount: 0 });

    const result = await service.runOnce();

    expect(result).toEqual({ sent: 0, skipped: 1 });
    expect(emailProvider.sendEmail).not.toHaveBeenCalled();
    expect(notificationService.create).not.toHaveBeenCalled();
  });
});
