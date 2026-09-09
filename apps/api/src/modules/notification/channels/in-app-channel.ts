import { Injectable } from '@nestjs/common';

@Injectable()
export class InAppChannel {
  async send(notification: any): Promise<boolean> {
    // In-app notifications are stored in the DB and delivered via SSE/WebSocket
    // The notification is already saved to DB by the service, so this just marks it as sent
    return true;
  }
}
