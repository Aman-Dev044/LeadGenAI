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
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Get('conversations')
  async getVisitorConversations(
    @Query('agentId') agentId: string,
    @Query('visitorId') visitorId: string,
  ) {
    if (!agentId || !visitorId) return [];
    const agent = await this.agentService.getPublicConfig(agentId);
    return this.conversationService.findVisitorConversations(agent.tenantId, agentId, visitorId);
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
    const clientIp = (info.ip || req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace(/^::ffff:/, '');

    let city = info.city;
    let country = info.country;
    let region = info.region;
    let countryCode = info.countryCode;
    const timezone = info.timezone;

    if (!city && !country && timezone) {
      if (timezone.includes('Kolkata') || timezone.includes('Calcutta')) {
        country = 'India';
        countryCode = 'IN';
      } else if (timezone.includes('Dubai')) {
        city = 'Dubai';
        country = 'United Arab Emirates';
      } else if (timezone.includes('New_York')) {
        city = 'New York';
        country = 'United States';
      } else if (timezone.includes('London')) {
        city = 'London';
        country = 'United Kingdom';
      }
    }

    return this.conversationService.create(agent.tenantId, {
      agentId: body.agentId,
      visitorId: body.visitorId,
      visitorInfo: {
        ...info,
        city,
        region,
        country,
        countryCode,
        timezone,
        ip: clientIp,
        userAgent: req.headers['user-agent'] || info.userAgent,
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

    const rawData: any = body.data || {};
    let firstName: string | undefined = rawData.firstName;
    let lastName: string | undefined = rawData.lastName;
    if (!firstName && rawData.name) {
      const parts = String(rawData.name).trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || undefined;
    }

    const lead = await this.leadService.captureFromWidget(agent.tenantId, {
      ...rawData,
      firstName,
      lastName,
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
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('conversations/:id/lead')
  async captureConversationLead(
    @Param('id') conversationId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const agentId = body.agentId;
    const agent = await this.agentService.getPublicConfig(agentId);
    let metadata: Record<string, any> = {
      userAgent: req.headers['user-agent'] || body.userAgent,
      ip: req.ip,
      url: body.url,
      referrer: body.referrer,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
    };
    if (conversationId) {
      const conv: any = await this.conversationService.findPublic(agent.tenantId, conversationId);
      const info: any = conv?.visitorInfo || {};
      metadata = {
        ...metadata,
        url: metadata.url || info.url,
        referrer: metadata.referrer || info.referrer,
        utmSource: metadata.utmSource || info.utmSource,
        utmMedium: metadata.utmMedium || info.utmMedium,
        utmCampaign: metadata.utmCampaign || info.utmCampaign,
      };
    }

    const rawData: any = body.data || body;
    let firstName: string | undefined = rawData.firstName;
    let lastName: string | undefined = rawData.lastName;
    if (!firstName && rawData.name) {
      const parts = String(rawData.name).trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || undefined;
    }

    const lead = await this.leadService.captureFromWidget(agent.tenantId, {
      ...rawData,
      firstName,
      lastName,
      conversationId,
      source: body.source || 'widget_form',
      metadata,
    });

    if (conversationId) {
      await this.conversationService.attachCapturedLead(agent.tenantId, conversationId, lead);
      this.conversationService.maybeSummarize(agent.tenantId, conversationId, 'lead_captured').catch(() => undefined);
    }

    return { success: true, lead };
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
