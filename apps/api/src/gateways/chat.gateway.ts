import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

interface ConnectedClient {
  socket: Socket;
  userId?: string;
  tenantId?: string;
  visitorId?: string;
  role: 'agent' | 'visitor';
}

/**
 * Chat namespace. Used by:
 *  - the embeddable widget (anonymous visitor, `auth.visitorId`) - runs on customer sites, so any origin
 *  - the dashboard (JWT `auth.token`) for live chat / take-over
 *
 * Note: Socket.IO CORS is engine-level (shared by all namespaces on this server); auth is enforced
 * per connection and per room instead.
 */
@WebSocketGateway({
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: false,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private clients = new Map<string, ConnectedClient>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
  ) {}

  afterInit() {
    this.logger.log('Chat WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      const visitorId = client.handshake.auth?.visitorId;

      if (token) {
        // Authenticated agent/user
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('jwt.accessSecret'),
        });
        this.clients.set(client.id, {
          socket: client,
          userId: payload.sub,
          tenantId: payload.tenantId,
          role: 'agent',
        });
        // Join tenant room for notifications
        client.join(`tenant:${payload.tenantId}`);
        this.logger.log(`Agent connected: ${payload.sub}`);
      } else if (typeof visitorId === 'string' && visitorId.length >= 6 && visitorId.length <= 64) {
        // Anonymous visitor from widget
        this.clients.set(client.id, {
          socket: client,
          visitorId,
          role: 'visitor',
        });
        this.logger.debug(`Visitor connected: ${visitorId}`);
      } else {
        client.disconnect();
        return;
      }
    } catch (error) {
      this.logger.warn(`Connection rejected: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      this.logger.debug(`Client disconnected: ${clientInfo.userId || clientInfo.visitorId}`);
      this.clients.delete(client.id);
    }
  }

  /**
   * Join a conversation room. Visitors may only join their own conversations,
   * agents only conversations of their tenant.
   */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const info = this.clients.get(client.id);
    const conversationId = data?.conversationId;
    if (!info || !conversationId || !/^[a-f\d]{24}$/i.test(conversationId)) {
      return { event: 'join_error', data: { conversationId, reason: 'invalid' } };
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .select('tenantId visitorId status mode')
      .lean();
    const allowed =
      !!conversation &&
      ((info.role === 'visitor' && (conversation as any).visitorId === info.visitorId) ||
        (info.role === 'agent' && (conversation as any).tenantId === info.tenantId));

    if (!allowed) {
      this.logger.warn(`join_conversation denied for ${info.userId || info.visitorId} on ${conversationId}`);
      return { event: 'join_error', data: { conversationId, reason: 'forbidden' } };
    }

    client.join(`conversation:${conversationId}`);
    return {
      event: 'joined',
      data: { conversationId, status: (conversation as any).status, mode: (conversation as any).mode },
    };
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo || !data?.conversationId) return;
    const room = `conversation:${data.conversationId}`;
    // Only relay typing inside rooms the sender has actually joined
    if (!client.rooms.has(room)) return;
    client.to(room).emit('typing', {
      conversationId: data.conversationId,
      sender: clientInfo.role,
      senderId: clientInfo.userId || clientInfo.visitorId,
      isTyping: !!data.isTyping,
    });
  }

  // Methods called by services to push real-time events

  emitNewMessage(conversationId: string, message: any) {
    this.server?.to(`conversation:${conversationId}`).emit('new_message', message);
  }

  /** Streaming bot reply: many `bot_stream` deltas, then one `bot_stream_end` with the saved message. */
  emitBotStream(conversationId: string, streamId: string, delta: string) {
    this.server?.to(`conversation:${conversationId}`).emit('bot_stream', { conversationId, streamId, delta });
  }

  emitBotStreamEnd(conversationId: string, streamId: string, message: any | null) {
    this.server?.to(`conversation:${conversationId}`).emit('bot_stream_end', { conversationId, streamId, message });
  }

  emitConversationUpdate(conversationId: string, update: any) {
    this.server?.to(`conversation:${conversationId}`).emit('conversation_updated', { conversationId, ...update });
  }

  emitNotification(tenantId: string, notification: any) {
    this.server?.to(`tenant:${tenantId}`).emit('notification', notification);
  }

  emitHandoffRequest(tenantId: string, handoff: any) {
    this.server?.to(`tenant:${tenantId}`).emit('handoff_request', handoff);
  }

  emitNewLead(tenantId: string, lead: any) {
    this.server?.to(`tenant:${tenantId}`).emit('new_lead', lead);
  }

  emitAppointmentCreated(tenantId: string, appointment: any) {
    this.server?.to(`tenant:${tenantId}`).emit('appointment_created', appointment);
    this.server?.to(`tenant:${tenantId}`).emit('appointment:created', appointment);
  }

  emitAppointmentUpdated(tenantId: string, appointment: any) {
    this.server?.to(`tenant:${tenantId}`).emit('appointment_updated', appointment);
    this.server?.to(`tenant:${tenantId}`).emit('appointment:updated', appointment);
  }

  getOnlineAgentCount(tenantId: string): number {
    let count = 0;
    for (const [, client] of this.clients) {
      if (client.role === 'agent' && client.tenantId === tenantId) {
        count++;
      }
    }
    return count;
  }

  /** User ids of agents currently connected for a tenant (used for handoff routing). */
  getOnlineAgentIds(tenantId: string): string[] {
    const ids = new Set<string>();
    for (const [, client] of this.clients) {
      if (client.role === 'agent' && client.tenantId === tenantId && client.userId) ids.add(client.userId);
    }
    return Array.from(ids);
  }
}
