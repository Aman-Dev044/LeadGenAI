import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateNotificationDto } from './dto';
import { EmailChannel } from './channels/email-channel';
import { InAppChannel } from './channels/in-app-channel';
import { SlackChannel } from './channels/slack-channel';
import { SmsChannel } from './channels/sms-channel';
import { WhatsAppChannel } from './channels/whatsapp-channel';
import { TeamsChannel } from './channels/teams-channel';
import { PushChannel } from './channels/push-channel';
import { NotificationGateway } from '../../gateways/notification.gateway';

type EmailFlag = 'emailOnNewLead' | 'emailOnHotLead' | 'emailOnHandoff';

export interface TenantNotificationInput {
  title: string;
  body?: string;
  type: string;
  data?: Record<string, any>;
}

export interface NotifyTenantOptions {
  /** If set, only this user is notified (plus tenant-level Slack/Teams). */
  assignedTo?: string;
  /** Tenant setting that decides whether an email is sent in addition to in-app. */
  emailFlag?: EmailFlag;
  /** Send to tenant-level Slack/Teams webhooks when configured. Default true. */
  channels?: boolean;
}

const DEFAULT_NOTIFY_ROLES = ['ADMIN', 'SALES_MANAGER'];

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    private readonly emailChannel: EmailChannel,
    private readonly inAppChannel: InAppChannel,
    private readonly slackChannel: SlackChannel,
    private readonly smsChannel: SmsChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly teamsChannel: TeamsChannel,
    private readonly pushChannel: PushChannel,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async create(tenantId: string, dto: CreateNotificationDto) {
    const notification = await this.notificationModel.create({
      tenantId,
      ...dto,
      status: 'pending',
    });

    // Send via channel asynchronously
    this.dispatch(notification).catch((err) => {
      this.logger.error(`Notification dispatch failed: ${err.message}`);
    });

    return notification;
  }

  async createBulk(tenantId: string, notifications: CreateNotificationDto[]) {
    const docs = notifications.map((dto) => ({
      tenantId,
      ...dto,
      status: 'pending',
    }));

    const created = await this.notificationModel.insertMany(docs);

    // Dispatch all
    for (const notification of created) {
      this.dispatch(notification).catch((err) => {
        this.logger.error(`Bulk notification dispatch failed: ${err.message}`);
      });
    }

    return { count: created.length };
  }

  /**
   * Notify the right people in a tenant about a platform event.
   * - assigned user (if any) or every active user whose role is in the tenant's notifyRoles
   * - in-app always; email when the tenant flag is enabled
   * - tenant-level Slack / Teams webhooks when configured
   */
  async notifyTenant(tenantId: string, input: TenantNotificationInput, opts: NotifyTenantOptions = {}) {
    const settings = await this.getTenantSettings(tenantId);
    const recipients = await this.resolveRecipients(tenantId, opts.assignedTo, settings.notifyRoles);

    const sendEmail = opts.emailFlag ? settings[opts.emailFlag] !== false : false;
    const created: any[] = [];

    for (const user of recipients) {
      created.push(await this.create(tenantId, { ...input, userId: String(user._id), channel: 'in_app' }));
      if (sendEmail && user.email) {
        created.push(await this.create(tenantId, { ...input, userId: String(user._id), channel: 'email' }));
      }
    }

    if (opts.channels !== false) {
      if (settings.slackWebhookUrl) {
        created.push(await this.create(tenantId, { ...input, channel: 'slack', recipient: settings.slackWebhookUrl }));
      }
      if (settings.teamsWebhookUrl) {
        created.push(await this.create(tenantId, { ...input, channel: 'teams', recipient: settings.teamsWebhookUrl }));
      }
    }

    return created;
  }

  /**
   * Message a lead directly (follow-up workflows). Uses the lead's own contact
   * details as the destination; returns null when the lead has no matching contact.
   */
  async sendToLead(
    tenantId: string,
    channel: 'email' | 'sms' | 'whatsapp',
    lead: any,
    input: TenantNotificationInput,
  ) {
    const recipient = channel === 'email' ? lead?.email : lead?.phone;
    if (!recipient) {
      this.logger.warn(`Lead ${lead?._id} has no ${channel === 'email' ? 'email' : 'phone'} - ${channel} skipped`);
      return null;
    }
    return this.create(tenantId, {
      ...input,
      channel,
      recipient,
      data: { ...(input.data || {}), leadId: String(lead._id), recipientType: 'lead' },
    });
  }

  async findByUser(tenantId: string, userId: string, unreadOnly = false) {
    const query: any = { tenantId, userId, channel: 'in_app' };
    if (unreadOnly) {
      query.readAt = null;
    }

    return this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  async markAsRead(tenantId: string, notificationId: string, userId: string) {
    return this.notificationModel.findOneAndUpdate(
      { _id: notificationId, tenantId, userId },
      { readAt: new Date(), status: 'read' },
      { new: true },
    );
  }

  async markAllAsRead(tenantId: string, userId: string) {
    await this.notificationModel.updateMany(
      { tenantId, userId, readAt: null },
      { readAt: new Date(), status: 'read' },
    );
    return { message: 'All notifications marked as read' };
  }

  async getUnreadCount(tenantId: string, userId: string) {
    const count = await this.notificationModel.countDocuments({
      tenantId,
      userId,
      channel: 'in_app',
      readAt: null,
    });
    return { count };
  }

  // Convenience methods for specific notification types
  async notifyNewLead(tenantId: string, lead: any, assignedToId?: string) {
    return this.notifyTenant(
      tenantId,
      {
        title: 'New Lead Captured',
        body: `${lead.firstName || ''} ${lead.lastName || ''} (${lead.email || 'No email'})`.trim(),
        type: 'new_lead',
        data: { leadId: String(lead._id) },
      },
      { assignedTo: assignedToId || lead.assignedTo, emailFlag: 'emailOnNewLead' },
    );
  }

  async notifyHandoff(tenantId: string, conversationId: string, assignedToId?: string) {
    return this.notifyTenant(
      tenantId,
      {
        title: 'Handoff Request',
        body: 'A conversation has been handed off to you',
        type: 'handoff_request',
        data: { conversationId },
      },
      { assignedTo: assignedToId, emailFlag: 'emailOnHandoff' },
    );
  }

  // ─── Internals ────────────────────────────────────────────────────

  private async getTenantSettings(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId).select('notificationSettings').lean();
    const s = (tenant as any)?.notificationSettings || {};
    return {
      emailOnNewLead: s.emailOnNewLead !== false,
      emailOnHotLead: s.emailOnHotLead !== false,
      emailOnHandoff: s.emailOnHandoff !== false,
      slackWebhookUrl: (s.slackWebhookUrl || '').trim(),
      teamsWebhookUrl: (s.teamsWebhookUrl || '').trim(),
      notifyRoles: Array.isArray(s.notifyRoles) && s.notifyRoles.length ? s.notifyRoles : DEFAULT_NOTIFY_ROLES,
    };
  }

  private async resolveRecipients(tenantId: string, assignedTo: string | undefined, roles: string[]) {
    const baseQuery = { tenantId, isActive: true, deletedAt: null };

    if (assignedTo) {
      const user: any = await this.userModel.findOne({ _id: assignedTo, ...baseQuery }).select('email role').lean();
      if (user) return [user] as any[];
    }

    const users: any[] = await this.userModel
      .find({ ...baseQuery, role: { $in: roles } })
      .select('email role')
      .limit(50)
      .lean();
    return users;
  }

  private async dispatch(notification: any): Promise<void> {
    let success = false;

    try {
      const user = notification.userId
        ? await this.userModel.findById(notification.userId).select('email phone').lean()
        : null;
      const recipient: string | undefined = notification.recipient;

      switch (notification.channel) {
        case 'email': {
          const to = recipient || (user as any)?.email;
          if (to) {
            success = await this.emailChannel.send(notification, to);
          } else {
            this.logger.warn(`No email destination for notification ${notification._id}`);
          }
          break;
        }

        case 'in_app':
          success = await this.inAppChannel.send(notification);
          break;

        case 'slack':
          success = await this.slackChannel.send(notification, recipient);
          break;

        case 'teams':
          success = await this.teamsChannel.send(notification, recipient);
          break;

        case 'sms': {
          const to = recipient || (user as any)?.phone;
          if (to) {
            success = await this.smsChannel.send(notification, to);
          } else {
            this.logger.warn(`No phone destination for notification ${notification._id} - SMS skipped`);
          }
          break;
        }

        case 'whatsapp': {
          const to = recipient || (user as any)?.phone;
          if (to) {
            success = await this.whatsAppChannel.send(notification, to);
          } else {
            this.logger.warn(`No phone destination for notification ${notification._id} - WhatsApp skipped`);
          }
          break;
        }

        case 'push':
          success = await this.pushChannel.send(notification);
          break;

        default:
          this.logger.warn(`Unknown channel: ${notification.channel}`);
      }

      notification.status = success ? 'sent' : 'failed';
      notification.sentAt = success ? new Date() : undefined;
      if (!success) {
        notification.errorMessage = `Failed to send via ${notification.channel}`;
      }
    } catch (error) {
      notification.status = 'failed';
      notification.errorMessage = error.message;
    }

    await notification.save();

    // Push to the dashboard in real time (only in_app notifications show in UI toast/bell)
    if (notification.userId && notification.channel === 'in_app') {
      try {
        this.notificationGateway.sendToUser(
          String(notification.userId),
          'notification:new',
          typeof notification.toObject === 'function' ? notification.toObject() : notification,
        );
      } catch (err) {
        this.logger.debug(`Realtime push skipped: ${err.message}`);
      }
    }
  }
}
