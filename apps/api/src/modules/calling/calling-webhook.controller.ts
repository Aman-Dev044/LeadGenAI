import { Body, Controller, Headers, HttpCode, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CallingService } from './calling.service';
import { Public } from '../../common/decorators';

/**
 * Unauthenticated endpoints the telephony providers call back into.
 *  - Vapi: JSON, verified by the shared `x-vapi-secret`
 *  - Twilio: form-encoded, verified by the HMAC `token` we put in every URL
 * Both must be reachable from the internet (PUBLIC_API_URL).
 */
@ApiTags('calling')
@Controller('calling/webhooks')
@Public()
@Throttle({ default: { limit: 600, ttl: 60_000 } })
export class CallingWebhookController {
  constructor(private readonly service: CallingService) {}

  /**
   * Raw JSON on purpose: for mid-call tool calls Vapi reads `results` from the
   * top level of the reply, so the global `{ success, data }` envelope would
   * make every booking look failed to the assistant.
   */
  @Post('vapi')
  async vapi(@Body() body: any, @Res() res: Response, @Headers('x-vapi-secret') secret?: string) {
    const result = await this.service.handleVapiWebhook(body, secret);
    res.status(200).json(result);
  }

  @Post('twilio/voice')
  async twilioVoice(@Query('callId') callId: string, @Query('token') token: string, @Res() res: Response) {
    const twiml = await this.service.twilioVoiceTwiml(callId, token);
    res.type('text/xml').send(twiml);
  }

  @Post('twilio/dial-status')
  async twilioDialStatus(
    @Query('callId') callId: string,
    @Query('token') token: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const twiml = await this.service.twilioDialStatus(callId, token, body);
    res.type('text/xml').send(twiml);
  }

  @Post('twilio/status')
  @HttpCode(200)
  twilioStatus(@Query('callId') callId: string, @Query('token') token: string, @Body() body: any) {
    return this.service.twilioStatus(callId, token, body);
  }

  @Post('twilio/recording')
  @HttpCode(200)
  twilioRecording(@Query('callId') callId: string, @Query('token') token: string, @Body() body: any) {
    return this.service.twilioRecording(callId, token, body);
  }
}
