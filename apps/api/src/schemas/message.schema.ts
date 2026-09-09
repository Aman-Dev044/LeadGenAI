import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({
    type: String,
    enum: ['visitor', 'bot', 'agent'],
    required: true,
  })
  sender: string;

  @Prop({ type: String })
  senderId: string;

  @Prop({ required: true })
  content: string;

  @Prop({
    type: String,
    enum: ['text', 'image', 'file', 'system', 'tool_result'],
    default: 'text',
  })
  type: string;

  @Prop({
    type: {
      toolName: String,
      toolInput: Object,
      toolOutput: Object,
    },
  })
  toolCall: {
    toolName?: string;
    toolInput?: Record<string, any>;
    toolOutput?: Record<string, any>;
  };

  @Prop({
    type: {
      fileName: String,
      fileUrl: String,
      fileSize: Number,
      mimeType: String,
    },
  })
  attachment: {
    fileName?: string;
    fileUrl?: string;
    fileSize?: number;
    mimeType?: string;
  };

  @Prop({
    type: {
      promptTokens: Number,
      completionTokens: Number,
      totalTokens: Number,
      model: String,
    },
  })
  tokenUsage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    model?: string;
  };

  @Prop({ type: Number })
  sentiment: number;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ tenantId: 1, createdAt: -1 });
