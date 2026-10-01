import { Injectable, Logger } from '@nestjs/common';

const TIMEOUT_MS = 20_000;

export interface TwilioCreds {
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
}

const XML_ESCAPES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
};
const escapeXml = (s: string) => String(s || '').replace(/[<>&'"]/g, (c) => XML_ESCAPES[c]);

/**
 * Click-to-call for salespeople. Twilio first rings the salesperson; when they
 * pick up, the TwiML from our webhook dials the lead and records both legs.
 * Nothing here talks to the AI - the recording comes back through the
 * recording webhook and is transcribed there.
 */
@Injectable()
export class TwilioVoiceProvider {
  private readonly logger = new Logger(TwilioVoiceProvider.name);

  isConfigured(creds: TwilioCreds): boolean {
    return !!(creds?.accountSid && creds?.authToken && creds?.phoneNumber);
  }

  /** Rings the salesperson. `voiceUrl` returns the TwiML that bridges the lead. */
  async startBridgedCall(params: {
    creds: TwilioCreds;
    salespersonNumber: string;
    voiceUrl: string;
    statusUrl: string;
  }): Promise<{ sid: string; status: string }> {
    const { creds } = params;
    if (!this.isConfigured(creds)) {
      throw new Error('Twilio is not configured: account SID, auth token and a voice-capable number are required.');
    }

    const body = new URLSearchParams({
      To: params.salespersonNumber,
      From: creds.phoneNumber!,
      Url: params.voiceUrl,
      Method: 'POST',
      StatusCallback: params.statusUrl,
      StatusCallbackMethod: 'POST',
      Timeout: '30',
    });
    for (const ev of ['initiated', 'ringing', 'answered', 'completed']) body.append('StatusCallbackEvent', ev);

    const res = await this.fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid!)}/Calls.json`,
      creds,
      {
        method: 'POST',
        body: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Twilio refused the call: ${json?.message || `HTTP ${res.status}`}`);
    return { sid: json.sid, status: json.status };
  }

  /** TwiML served when the salesperson answers: announce, then dial the lead. */
  bridgeTwiml(params: {
    leadName: string;
    leadNumber: string;
    callerId: string;
    record: boolean;
    recordingUrl: string;
    dialStatusUrl: string;
  }): string {
    const recordAttrs = params.record
      ? ` record="record-from-answer-dual" recordingStatusCallback="${escapeXml(params.recordingUrl)}"` +
        ` recordingStatusCallbackEvent="completed" recordingStatusCallbackMethod="POST"`
      : '';
    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
      `<Say voice="alice">Connecting you to ${escapeXml(params.leadName)}.${params.record ? ' This call is recorded.' : ''}</Say>` +
      `<Dial callerId="${escapeXml(params.callerId)}" timeout="25" action="${escapeXml(params.dialStatusUrl)}" method="POST"${recordAttrs}>` +
      `<Number>${escapeXml(params.leadNumber)}</Number>` +
      '</Dial>' +
      '</Response>'
    );
  }

  /** Recording media needs the account's basic auth. */
  async downloadRecording(creds: TwilioCreds, recordingUrl: string): Promise<Buffer> {
    const url = /\.(mp3|wav)$/i.test(recordingUrl) ? recordingUrl : `${recordingUrl}.mp3`;
    const res = await this.fetch(url, creds, { method: 'GET' }, 60_000);
    if (!res.ok) throw new Error(`Recording download failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async fetch(url: string, creds: TwilioCreds, init: RequestInit, timeout = TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const basic = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { Authorization: `Basic ${basic}`, ...((init.headers as Record<string, string>) || {}) },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Twilio did not answer in time');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
