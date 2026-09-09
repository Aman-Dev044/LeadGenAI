import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSupportTicketDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { escapeRegex } from '../../common/utils/sanitize';

@Injectable()
export class SupportTicketService {
  constructor(
    @InjectModel('SupportTicket') private readonly ticketModel: Model<any>,
  ) {}

  async create(tenantId: string, dto: CreateSupportTicketDto) {
    return this.ticketModel.create({ tenantId, ...dto });
  }

  async findAll(tenantId: string, paginationDto: PaginationDto, filters?: any) {
    const query: any = { tenantId };
    if (filters?.status) query.status = filters.status;
    if (filters?.priority) query.priority = filters.priority;
    if (filters?.assignedTo) query.assignedTo = filters.assignedTo;

    if (paginationDto.search) {
      const safeSearch = escapeRegex(paginationDto.search);
      query.$or = [
        { subject: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    return paginate(this.ticketModel, query, paginationDto);
  }

  async findById(tenantId: string, ticketId: string) {
    const ticket = await this.ticketModel.findOne({ _id: ticketId, tenantId });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  async updateStatus(tenantId: string, ticketId: string, status: string) {
    const update: any = { status };
    if (status === 'resolved') update.resolvedAt = new Date();
    if (status === 'closed') update.closedAt = new Date();

    const ticket = await this.ticketModel.findOneAndUpdate(
      { _id: ticketId, tenantId },
      { $set: update },
      { new: true },
    );
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  async assign(tenantId: string, ticketId: string, assignedTo: string) {
    const ticket = await this.ticketModel.findOneAndUpdate(
      { _id: ticketId, tenantId },
      { $set: { assignedTo, status: 'in_progress' } },
      { new: true },
    );
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  async addNote(tenantId: string, ticketId: string, content: string, userId: string) {
    const ticket = await this.ticketModel.findOneAndUpdate(
      { _id: ticketId, tenantId },
      {
        $push: {
          notes: { content, createdBy: userId, createdAt: new Date() },
        },
      },
      { new: true },
    );
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }
}
