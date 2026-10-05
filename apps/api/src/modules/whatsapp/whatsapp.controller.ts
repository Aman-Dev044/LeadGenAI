import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppAiService } from './whatsapp-ai.service';
import { TwilioWhatsAppSender } from './twilio-whatsapp.sender';
import { CurrentTenant, CurrentUser, Public, Roles } from '../../common/decorators';

const TEAM = ['ADMIN', 'SALES_MANAGER', 'SALESPERSON'] as const;
const MANAGERS = ['ADMIN', 'SALES_MANAGER'] as const;

/**
 * WhatsApp AI:
 *   POST /whatsapp/twilio/inbound/:tenantId   Twilio "message comes in" (public, signed)
 *   POST /whatsapp/twilio/status/:tenantId    Twilio delivery status (public)
 *   GET  /whatsapp/media/:kind/:id?s=        media bytes for Twilio / the dashboard (public, signed)
 *   settings, media library, bookings, conversation take-over for the team
 */
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly service: WhatsAppAiService,
    private readonly sender: TwilioWhatsAppSender,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
  ) {}

  // ─── Twilio webhooks ──────────────────────────────────────────────

  @Post('twilio/inbound/:tenantId')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 600 } })
  async inbound(
    @Param('tenantId') tenantId: string,
    @Body() form: Record<string, any>,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
    const candidates = [this.sender.inboundUrl(tenantId), `${proto}://${host}${req.originalUrl}`, `https://${host}${req.originalUrl}`];
    const ok = await this.sender.verifySignature(tenantId, signature, candidates, form);
    if (!ok) {
      res.status(403).type('text/xml').send('<Response/>');
      return;
    }
    // Answer Twilio at once; the AI reply goes out on its own
    res.type('text/xml').send('<Response/>');
    this.service.handleInbound(tenantId, form).catch(() => undefined);
  }

  @Post('twilio/status/:tenantId')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 1200 } })
  async status(@Param('tenantId') tenantId: string, @Body() form: Record<string, any>, @Res() res: Response) {
    res.type('text/xml').send('<Response/>');
    this.service.handleStatus(tenantId, form).catch(() => undefined);
  }

  @Get('media/:kind/:id')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 300 } })
  async media(@Param('kind') kind: string, @Param('id') id: string, @Query('s') sig: string, @Res() res: Response) {
    if ((kind !== 'lib' && kind !== 'msg') || !/^[a-f\d]{24}$/i.test(id) || !this.service.verifyMediaSig(id, sig)) {
      res.status(404).send('Not found');
      return;
    }
    const file = await this.service.readMedia(kind, id);
    if (!file) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(file.body);
  }

  // ─── Settings / status ────────────────────────────────────────────

  @Get('status')
  @Roles(...TEAM, 'VIEWER')
  getStatus(@CurrentTenant() tenantId: string) {
    return this.service.status(tenantId);
  }

  @Get('settings')
  @Roles(...MANAGERS)
  getSettings(@CurrentTenant() tenantId: string) {
    return this.service.getSettings(tenantId);
  }

  @Put('settings')
  @Roles(...MANAGERS)
  updateSettings(@CurrentTenant() tenantId: string, @Body() body: Record<string, any>) {
    return this.service.updateSettings(tenantId, body || {});
  }

  @Post('configure-webhook')
  @Roles(...MANAGERS)
  configureWebhook(@CurrentTenant() tenantId: string) {
    return this.service.configureWebhook(tenantId);
  }

  // ─── Media library ────────────────────────────────────────────────

  @Get('media')
  @Roles(...TEAM)
  listMedia(@CurrentTenant() tenantId: string) {
    return this.service.listMedia(tenantId);
  }

  @Post('media')
  @Roles(...MANAGERS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype);
        cb(ok ? null : new BadRequestException('Only JPG, PNG, WEBP images and PDF files are allowed (max 5MB)'), ok);
      },
    }),
  )
  uploadMedia(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { userId: string },
    @UploadedFile() file: any,
    @Body() body: { title?: string; description?: string; tags?: string },
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.service.addMedia(tenantId, user.userId, file, body || {});
  }

  @Patch('media/:id')
  @Roles(...MANAGERS)
  updateMedia(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() body: { title?: string; description?: string; tags?: string[] }) {
    return this.service.updateMedia(tenantId, id, body || {});
  }

  @Delete('media/:id')
  @Roles(...MANAGERS)
  removeMedia(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.removeMedia(tenantId, id);
  }

  // ─── Bookings ─────────────────────────────────────────────────────

  @Get('bookings')
  @Roles(...TEAM, 'VIEWER')
  listBookings(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query('status') status?: string,
    @Query('leadId') leadId?: string,
  ) {
    return this.service.listBookings(tenantId, { status, leadId }, user.role === 'SALESPERSON' ? user.userId : undefined);
  }

  @Patch('bookings/:id')
  @Roles(...TEAM)
  updateBooking(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { paymentLink?: string; status?: string; notes?: string; amount?: number },
  ) {
    return this.service.updateBooking(tenantId, id, body || {}, user.userId);
  }

  // ─── Conversation control (take over / give back to the AI) ──────

  @Post('conversations/:id/mode')
  @Roles(...TEAM)
  async setMode(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
    @Body('mode') mode: 'bot' | 'human',
  ) {
    if (mode !== 'bot' && mode !== 'human') throw new BadRequestException('mode must be bot or human');
    if (user.role === 'SALESPERSON') {
      const conv: any = await this.conversationModel.findOne({ _id: id, tenantId }).select('leadId assignedUserId').lean();
      if (conv?.assignedUserId && conv.assignedUserId !== user.userId) throw new ForbiddenException('Not your conversation');
    }
    return this.service.setMode(tenantId, id, mode, user.userId);
  }

  /** Ask the AI to answer now (e.g. after a human handed the chat back). */
  @Post('conversations/:id/ai-reply')
  @Roles(...TEAM)
  async aiReply(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    await this.service.reply(tenantId, id, { force: true });
    return { ok: true };
  }
}
