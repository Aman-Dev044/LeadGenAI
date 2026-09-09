import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@WebSocketGateway({
  // CORS is engine-level and shared with the /chat namespace (widget on customer sites);
  // this namespace is protected by the JWT handshake instead.
  cors: {
    origin: true,
    credentials: false,
  },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private userSockets = new Map<string, Set<string>>();
  private socketUsers = new Map<string, { userId: string; tenantId: string }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });

      const userId = payload.sub;
      client.join(`user:${userId}`);
      client.join(`tenant:${payload.tenantId}`);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      this.socketUsers.set(client.id, { userId, tenantId: payload.tenantId });

      this.logger.log(`User connected to notifications: ${userId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.socketUsers.delete(client.id);
    for (const [userId, sockets] of this.userSockets) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(userId);
        break;
      }
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ) {
    const ctx = this.socketUsers.get(client.id);
    if (ctx && data?.notificationId) {
      await this.notificationModel.updateOne(
        { _id: data.notificationId, tenantId: ctx.tenantId, userId: ctx.userId },
        { $set: { readAt: new Date(), status: 'read' } },
      );
      await this.emitUnreadCount(client, ctx);
    }
    return { event: 'marked_read', data: { id: data?.notificationId } };
  }

  @SubscribeMessage('notification:get-unread-count')
  async handleGetUnreadCount(@ConnectedSocket() client: Socket) {
    const ctx = this.socketUsers.get(client.id);
    if (!ctx) return;
    await this.emitUnreadCount(client, ctx);
  }

  private async emitUnreadCount(client: Socket, ctx: { userId: string; tenantId: string }) {
    try {
      const count = await this.notificationModel.countDocuments({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        readAt: null,
      });
      client.emit('notification:unread-count', count);
    } catch (err) {
      this.logger.warn(`Unread count failed: ${err.message}`);
    }
  }

  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  sendToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }
}
