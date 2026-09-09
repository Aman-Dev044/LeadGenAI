import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class PushChannel {
  private readonly logger = new Logger(PushChannel.name);

  constructor(
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
  ) {}

  async send(notification: any): Promise<boolean> {
    // Web push notifications work via the NotificationGateway (WebSocket)
    // The notification is already stored in DB by NotificationService.
    // The WebSocket gateway picks it up and pushes to connected clients in real-time.
    // This channel just ensures the notification is marked for push delivery.
    try {
      await this.notificationModel.updateOne(
        { _id: notification._id },
        { $set: { pushDelivered: true } },
      );
      return true;
    } catch (error) {
      this.logger.error(`Push notification failed: ${error.message}`);
      return false;
    }
  }
}
