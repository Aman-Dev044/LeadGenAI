import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  /**
   * Universal Inbound Webhook for any external form, landing page,
   * Google Forms/Sheets, Typeform, Elementor, Zapier, Make or n8n.
   */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Post('webhook/:apiKey')
  @HttpCode(HttpStatus.OK)
  async handleUniversalWebhook(
    @Param('apiKey') apiKey: string,
    @Body() body: any,
  ) {
    const tenant = await this.integrationsService.resolveTenant(apiKey);
    const result = await this.integrationsService.ingestLead(tenant._id.toString(), body, body?.source || 'webhook');
    return {
      success: true,
      message: 'Lead captured successfully',
      data: result,
    };
  }

  /**
   * Meta Ads (Facebook & Instagram LeadGen) Webhook Verification.
   */
  @Public()
  @Get('meta/webhook/:token')
  verifyMetaWebhook(
    @Param('token') token: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    // Check mode and verify token
    if (mode === 'subscribe' && (verifyToken === token || verifyToken === 'leadgen_meta_token')) {
      return res.status(HttpStatus.OK).send(challenge);
    }
    return res.status(HttpStatus.FORBIDDEN).send('Verification token mismatch');
  }

  /**
   * Meta Ads Webhook Event Ingestion.
   */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Post('meta/webhook/:token')
  @HttpCode(HttpStatus.OK)
  async handleMetaWebhook(
    @Param('token') token: string,
    @Body() body: any,
  ) {
    const tenant = await this.integrationsService.resolveTenant(token);
    const result = await this.integrationsService.processMetaAdsPayload(tenant._id.toString(), body);
    return { success: true, result };
  }

  /**
   * WhatsApp Cloud API Webhook Verification.
   */
  @Public()
  @Get('whatsapp/webhook/:token')
  verifyWhatsAppWebhook(
    @Param('token') token: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && (verifyToken === token || verifyToken === 'whatsapp_verify_token')) {
      return res.status(HttpStatus.OK).send(challenge);
    }
    return res.status(HttpStatus.FORBIDDEN).send('Verification token mismatch');
  }

  /**
   * WhatsApp Cloud API Incoming Message Ingestion.
   */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Post('whatsapp/webhook/:token')
  @HttpCode(HttpStatus.OK)
  async handleWhatsAppWebhook(
    @Param('token') token: string,
    @Body() body: any,
  ) {
    const tenant = await this.integrationsService.resolveTenant(token);
    const result = await this.integrationsService.processWhatsAppPayload(tenant._id.toString(), body);
    return { success: true, result };
  }

  /**
   * Trigger a test lead directly into the current tenant's Leads CRM.
   * Useful for testing integration flow from the Dashboard UI.
   */
  @Post('test-lead')
  async sendTestLead(
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    const tenantId = user?.tenantId;
    const sample = body?.lead || {
      name: 'Rahul Sharma',
      email: `rahul.test.${Date.now().toString(36)}@example.com`,
      phone: '+91 98765 43210',
      company: 'Innovate Digital Pvt Ltd',
      source: body?.source || 'google_form',
      notes: 'Interested in AI Lead Generation pricing and demo.',
      city: 'Mumbai',
      budget: '$2,000 - $5,000',
    };

    const result = await this.integrationsService.ingestLead(tenantId, sample, sample.source);
    return {
      success: true,
      message: 'Test lead created! Check your Leads CRM table now.',
      data: result,
    };
  }

  /**
   * Get integration endpoints and configuration info for the logged-in tenant.
   */
  @Get('info')
  async getIntegrationInfo(
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const host = req.get('host') || 'localhost:4000';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}/api/v1`;

    const tenantId = user?.tenantId;

    return {
      tenantId,
      universalWebhookUrl: `${baseUrl}/integrations/webhook/${tenantId}`,
      metaWebhookUrl: `${baseUrl}/integrations/meta/webhook/${tenantId}`,
      whatsAppWebhookUrl: `${baseUrl}/integrations/whatsapp/webhook/${tenantId}`,
      verifyToken: tenantId,
      samplePayload: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+91 9876543210',
        company: 'Acme Corp',
        source: 'google_form',
        notes: 'Inquiry about enterprise package',
      },
    };
  }
}
