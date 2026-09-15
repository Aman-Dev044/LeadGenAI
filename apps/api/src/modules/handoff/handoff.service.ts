import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateHandoffDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { EventBusService, PlatformEvents } from '../../common/events';

@Injectable()
export class HandoffService {
  constructor(
    @InjectModel('Handoff') private readonly handoffModel: Model<any>,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    private readonly bus: EventBusService,
  ) {}

  async create(tenantId: string, dto: CreateHandoffDto) {
    const conversation = await this.conversationModel.findOne({
      _id: dto.conversationId,
      tenantId,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const handoff = await this.handoffModel.create({
      tenantId,
      conversationId: dto.conversationId,
      agentId: dto.agentId,
      assignedTo: dto.assignedTo,
      reason: dto.reason,
      status: 'pending',
      context: {
        conversationSummary: conversation.summary,
        sentiment: conversation.sentiment,
      },
    });

    // Update conversation status
    conversation.status = 'handed_off';
    conversation.mode = 'human';
    if (dto.assignedTo) {
      conversation.assignedUserId = dto.assignedTo;
    }
    await conversation.save();

    this.bus.emit(PlatformEvents.HANDOFF_CREATED, { tenantId, handoff, conversation });
    return handoff;
  }

  async findAll(tenantId: string, paginationDto: PaginationDto, status?: string, forUserId?: string) {
    const query: any = { tenantId };
    if (status) query.status = status;
    if (forUserId) {
      // Pending (unclaimed) handoffs are visible to every salesperson so they can accept them;
      // everything else is limited to what this user owns.
      query.$or = [{ status: 'pending' }, { assignedTo: forUserId }];
    }
    return paginate(this.handoffModel, query, paginationDto);
  }

  async findById(tenantId: string, handoffId: string) {
    const handoff = await this.handoffModel.findOne({ _id: handoffId, tenantId });
    if (!handoff) {
      throw new NotFoundException('Handoff not found');
    }
    return handoff;
  }

  async accept(tenantId: string, handoffId: string, userId: string) {
    const handoff = await this.handoffModel.findOne({
      _id: handoffId,
      tenantId,
      status: 'pending',
    });
    if (!handoff) {
      throw new NotFoundException('Pending handoff not found');
    }

    handoff.status = 'accepted';
    handoff.assignedTo = userId;
    handoff.acceptedAt = new Date();
    await handoff.save();

    // Update conversation with assigned user
    await this.conversationModel.updateOne(
      { _id: handoff.conversationId },
      { assignedUserId: userId, mode: 'human' },
    );

    this.bus.emit(PlatformEvents.HANDOFF_ACCEPTED, { tenantId, handoff });
    return handoff;
  }

  async reject(tenantId: string, handoffId: string, userId: string, notes?: string) {
    const handoff = await this.handoffModel.findOne({
      _id: handoffId,
      tenantId,
      status: 'pending',
    });
    if (!handoff) {
      throw new NotFoundException('Pending handoff not found');
    }

    handoff.status = 'rejected';
    handoff.notes = notes;
    await handoff.save();

    // Revert conversation back to bot mode
    await this.conversationModel.updateOne(
      { _id: handoff.conversationId },
      { status: 'active', mode: 'bot', assignedUserId: null },
    );

    this.bus.emit(PlatformEvents.HANDOFF_REJECTED, { tenantId, handoff });
    return handoff;
  }

  async complete(tenantId: string, handoffId: string, notes?: string) {
    const handoff = await this.handoffModel.findOne({
      _id: handoffId,
      tenantId,
      status: 'accepted',
    });
    if (!handoff) {
      throw new NotFoundException('Active handoff not found');
    }

    handoff.status = 'completed';
    handoff.completedAt = new Date();
    handoff.notes = notes || handoff.notes;
    await handoff.save();

    // End or return conversation to bot
    await this.conversationModel.updateOne(
      { _id: handoff.conversationId },
      { status: 'ended', endedAt: new Date() },
    );

    this.bus.emit(PlatformEvents.HANDOFF_COMPLETED, { tenantId, handoff });
    const conversation = await this.conversationModel.findById(handoff.conversationId);
    if (conversation) this.bus.emit(PlatformEvents.CONVERSATION_ENDED, { tenantId, conversation });
    return handoff;
  }

  async getPendingCount(tenantId: string) {
    const count = await this.handoffModel.countDocuments({
      tenantId,
      status: 'pending',
    });
    return { count };
  }
}
