import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { AgentService } from '../agent/agent.service';
import { ConversationService } from '../conversation/conversation.service';
import { LeadService } from '../lead/lead.service';
import { VisitorTrackingService } from '../visitor-tracking/visitor-tracking.service';
import {
  StartConversationDto,
  CaptureLeadDto,
  RecordConsentDto,
  RecordPageViewDto,
} from './dto';

@Controller('widget')
export class WidgetController {
  constructor(
    private readonly agentService: AgentService,
    private readonly conversationService: ConversationService,
    private readonly leadService: LeadService,
    private readonly trackingService: VisitorTrackingService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('config/:agentId')
  async getConfig(@Param('agentId') agentId: string) {
    return this.agentService.getPublicConfig(agentId);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('conversations/start')
  async startConversation(
    @Body() body: StartConversationDto,
    @Req() req: any,
  ) {
    const agent = await this.agentService.getPublicConfig(body.agentId);
    const info = body.visitorInfo || {};
    return this.conversationService.create(agent.tenantId, {
      agentId: body.agentId,
      visitorId: body.visitorId,
      visitorInfo: {
        url: info.url,
        referrer: info.referrer,
        utmSource: info.utmSource,
        utmMedium: info.utmMedium,
        utmCampaign: info.utmCampaign,
        utmTerm: info.utmTerm,
        utmContent: info.utmContent,
        device: info.device,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      } as any,
    });
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('leads/capture')
  async captureLead(@Body() body: CaptureLeadDto, @Req() req: any) {
    const agent = await this.agentService.getPublicConfig(body.agentId);
    let metadata: Record<string, any> = { userAgent: req.headers['user-agent'], ip: req.ip };
    if (body.conversationId) {
      const conv: any = await this.conversationService.findPublic(agent.tenantId, body.conversationId);
      const info: any = conv?.visitorInfo || {};
      metadata = {
        ...metadata,
        url: info.url,
        referrer: info.referrer,
        utmSource: info.utmSource,
        utmMedium: info.utmMedium,
        utmCampaign: info.utmCampaign,
      };
    }
    const lead = await this.leadService.captureFromWidget(agent.tenantId, {
      ...body.data,
      conversationId: body.conversationId,
      source: 'widget',
      metadata,
    });
    if (body.conversationId) {
      await this.conversationService.attachCapturedLead(agent.tenantId, body.conversationId, lead);
      this.conversationService.maybeSummarize(agent.tenantId, body.conversationId, 'lead_captured').catch(() => undefined);
    }
    return lead;
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Post('conversations/:id/visitor-message')
  async sendVisitorMessage(
    @Param('id') conversationId: string,
    @Body() body: { content: string; visitorId: string; agentId: string },
  ) {
    const agent = await this.agentService.getPublicConfig(body.agentId);
    return this.conversationService.sendVisitorMessage(
      agent.tenantId,
      conversationId,
      body.content,
      body.visitorId,
    );
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Query('agentId') agentId: string,
    @Query('limit') limit?: string,
  ) {
    const agent = await this.agentService.getPublicConfig(agentId);
    return this.conversationService.getMessages(
      agent.tenantId,
      conversationId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('consent')
  async recordConsent(
    @Body() body: RecordConsentDto,
    @Req() req: any,
  ) {
    const agent = await this.agentService.getPublicConfig(body.agentId);
    return {
      tenantId: agent.tenantId,
      visitorId: body.visitorId,
      consentType: body.consentType,
      granted: body.granted,
      recorded: true,
    };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Post('pageview')
  async recordPageView(
    @Body() body: RecordPageViewDto,
    @Req() req: any,
  ) {
    return this.trackingService.recordPageView({
      agentId: body.agentId,
      visitorId: body.visitorId,
      url: body.url,
      title: body.title,
      referrer: body.referrer,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      utm: body.utm,
    });
  }
}
