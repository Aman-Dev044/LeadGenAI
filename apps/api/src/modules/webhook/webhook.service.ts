import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Injectable()
export class WebhookService {
  constructor(
    @InjectModel('Webhook') private readonly webhookModel: Model<any>,
    @InjectModel('WebhookLog') private readonly webhookLogModel: Model<any>,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}

  async create(tenantId: string, dto: CreateWebhookDto) {
    const secret = crypto.randomBytes(32).toString('hex');
    const webhook = await this.webhookModel.create({
      tenantId,
      ...dto,
      secret,
    });

    // Return secret only on creation
    return {
      ...webhook.toObject(),
      secret,
    };
  }

  async findAll(tenantId: string, paginationDto: PaginationDto) {
    const query: any = {};
    if (tenantId && tenantId !== 'all') {
      query.tenantId = tenantId;
    }
    return paginate(this.webhookModel, query, paginationDto);
  }

  async findById(tenantId: string, webhookId: string) {
    const filter: any = { _id: webhookId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    const webhook = await this.webhookModel.findOne(filter);
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async update(tenantId: string, webhookId: string, dto: UpdateWebhookDto) {
    const filter: any = { _id: webhookId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    const webhook = await this.webhookModel.findOneAndUpdate(
      filter,
      { $set: dto },
      { new: true },
    );
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async remove(tenantId: string, webhookId: string) {
    const filter: any = { _id: webhookId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    const webhook = await this.webhookModel.findOneAndDelete(filter);
    if (!webhook) throw new NotFoundException('Webhook not found');
    return { message: 'Webhook deleted' };
  }

  async getLogs(tenantId: string, webhookId: string, paginationDto: PaginationDto) {
    const filter: any = { webhookId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    return paginate(
      this.webhookLogModel,
      filter,
      paginationDto,
    );
  }

  async testWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.findById(tenantId, webhookId);
    await this.dispatcher.dispatch(webhook.tenantId || tenantId, 'webhook.test', {
      message: 'This is a test webhook delivery',
      timestamp: new Date().toISOString(),
    });
    return { message: 'Test webhook dispatched' };
  }

  async retryDelivery(tenantId: string, webhookId: string, logId: string) {
    const log = await this.webhookLogModel.findOne({
      _id: logId,
      webhookId,
      tenantId,
      status: 'failed',
    });
    if (!log) throw new NotFoundException('Failed webhook log not found');

    await this.dispatcher.dispatch(tenantId, log.event, log.payload);
    return { message: 'Retry dispatched' };
  }
}
