import { Injectable, Logger } from '@nestjs/common';
import {
  IVoiceProvider,
  OutboundCallRequest,
  OutboundCallResult,
  VoiceCallEvent,
} from './voice-provider.interface';
import { renderTemplate } from '../calling-settings';
import { speakable } from '../speech-text';

/**
 * Voices that sound like a person on an Indian sales call. ElevenLabs
 * multilingual handles Hinglish without the robotic cadence of stock TTS;
 * the Vapi voices stay as a no-key fallback.
 */
const VOICE_PRESETS: Record<string, any> = {
  Neha: { provider: 'vapi', voiceId: 'Neha' },
  Naina: { provider: 'vapi', voiceId: 'Naina' },
  Sagar: { provider: 'vapi', voiceId: 'Sagar' },
  Rohan: { provider: 'vapi', voiceId: 'Rohan' },
  Paige: { provider: 'vapi', voiceId: 'Paige' },
  Elliot: { provider: 'vapi', voiceId: 'Elliot' },
  Lily: { provider: 'vapi', voiceId: 'Lily' },
  Harry: { provider: 'vapi', voiceId: 'Harry' },
};

/**
 * Slows only the greeting: a short pause after each clause so the name and the
 * company land clearly. Ellipses are read as pauses by the voice engine; the
 * rest of the call is unaffected.
 */
function slowGreeting(text: string): string {
  return text
    .replace(/\s*[,.!]\s+/g, (m) => `${m.trim()}... `)
    .replace(/\.{3,}\s*\.{3,}/g, '...')
    .trim();
}

const VAPI_BASE = process.env.VAPI_API_BASE_URL || 'https://api.vapi.ai';
const TIMEOUT_MS = 20_000;

/**
 * What the assistant must extract by the end of every call. Vapi runs this
 * over the transcript itself, so the outcome arrives with the call report and
 * no second LLM pass is needed (CallAnalysisService is the fallback).
 */
export const VAPI_STRUCTURED_DATA_SCHEMA = {
  type: 'object',
  properties: {
    outcome: {
      type: 'string',
      enum: [
        'interested',
        'not_interested',
        'callback',
        'meeting_booked',
        'no_answer',
        'voicemail',
        'wrong_number',
        'unknown',
      ],
      description: 'Overall result of the conversation.',
    },
    interestLevel: { type: 'number', description: 'How likely the person is to buy, 0 to 100.' },
    requirement: { type: 'string', description: 'What they need, in one or two sentences.' },
    budget: { type: 'string', description: 'Budget mentioned, or empty.' },
    timeline: { type: 'string', description: 'When they want to start, or empty.' },
    objections: { type: 'array', items: { type: 'string' }, description: 'Concerns they raised.' },
    keyPoints: { type: 'array', items: { type: 'string' }, description: 'Up to 5 facts worth remembering.' },
    whatsappDetails: {
      type: 'string',
      description:
        'If the agent promised to send anything on WhatsApp (prices, options, package details, address, timings, links, next steps), write the exact details that were discussed and should be sent, as a short message to the customer (2-5 lines, plain text, no greeting). Empty string if nothing was promised.',
    },
    callbackAt: {
      type: 'string',
      description: 'ISO 8601 date-time if they asked to be called back at a specific time, else empty.',
    },
    meetingAt: {
      type: 'string',
      description: 'ISO 8601 date-time if a meeting or demo was agreed, else empty.',
    },
    nextAction: {
      type: 'string',
      enum: ['call', 'whatsapp', 'email', 'meeting', 'none'],
      description: 'What our team should do next.',
    },
    nextActionInHours: { type: 'number', description: 'How soon the next action should happen, in hours.' },
    nextActionReason: { type: 'string', description: 'One sentence on why.' },
    language: { type: 'string', description: 'Language the person preferred (en, hi, hinglish...).' },
  },
  required: ['outcome', 'interestLevel', 'nextAction'],
};

const LANGUAGE_TRANSCRIBER: Record<string, any> = {
  en: { provider: 'deepgram', model: 'nova-2', language: 'en' },
  hi: { provider: 'deepgram', model: 'nova-2', language: 'hi' },
  'hi-en': { provider: 'deepgram', model: 'nova-3', language: 'multi' },
};

@Injectable()
export class VapiProvider implements IVoiceProvider {
  readonly id = 'vapi';
  private readonly logger = new Logger(VapiProvider.name);

  isConfigured(credentials: Record<string, string>): boolean {
    return !!(credentials?.apiKey && credentials?.phoneNumberId);
  }

  async startOutboundCall(rawReq: OutboundCallRequest): Promise<OutboundCallResult> {
    const { credentials } = rawReq;
    if (!this.isConfigured(credentials)) {
      throw new Error('Vapi is not configured: API key and phone number id are required.');
    }

    // Per-lead / per-playbook overrides on top of the workspace defaults
    const pb = rawReq.playbook;
    const req: OutboundCallRequest = {
      ...rawReq,
      assistant: {
        ...rawReq.assistant,
        agentName: pb?.agentName || rawReq.assistant.agentName,
        language: rawReq.lead.language || pb?.language || rawReq.assistant.language,
        firstMessage: pb?.firstMessage || rawReq.assistant.firstMessage,
      },
    };

    const vars = {
      leadName: req.lead.firstName || req.lead.name || 'there',
      leadFullName: req.lead.name,
      company: req.lead.company || '',
      agentName: req.assistant.agentName,
      companyName: req.assistant.companyName || 'our team',
    };

    const metadata = { tenantId: req.tenantId, callId: req.callId, leadId: req.lead.id, reason: req.reason };
    const body: any = {
      phoneNumberId: credentials.phoneNumberId,
      customer: {
        number: req.toNumber,
        name: req.lead.name?.slice(0, 40) || undefined,
      },
      metadata,
    };

    const server = {
      url: req.webhookUrl,
      ...(credentials.webhookSecret ? { secret: credentials.webhookSecret } : {}),
    };

    if (credentials.assistantId) {
      // A hand-tuned assistant in the Vapi dashboard: inject only what changes per lead
      body.assistantId = credentials.assistantId;
      body.assistantOverrides = {
        variableValues: { ...vars, leadContext: speakable(this.leadContext(req)) },
        server,
        metadata,
      };
    } else {
      body.assistant = this.buildAssistant(req, vars, server, metadata);
    }

    const res = await this.fetch(`${VAPI_BASE}/call`, credentials.apiKey, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = Array.isArray(json?.message) ? json.message.join('; ') : json?.message || `HTTP ${res.status}`;
      throw new Error(`Vapi refused the call: ${msg}`);
    }
    return { externalId: json.id, status: json.status || 'queued', raw: json };
  }

  /** The call as Vapi sees it now (status, and the full report once ended). */
  async fetchCall(externalId: string, apiKey: string): Promise<any | null> {
    const res = await this.fetch(`${VAPI_BASE}/call/${encodeURIComponent(externalId)}`, apiKey, { method: 'GET' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Vapi returned ${res.status}`);
    return res.json();
  }

  /** Cancels a call that is still queued/ringing. Best effort. */
  async endCall(externalId: string, apiKey: string): Promise<void> {
    try {
      await this.fetch(`${VAPI_BASE}/call/${encodeURIComponent(externalId)}`, apiKey, { method: 'DELETE' });
    } catch (err: any) {
      this.logger.warn(`Could not cancel Vapi call ${externalId}: ${err?.message}`);
    }
  }

  /** Mid-call tools: live transfer + booking/callback functions answered by our webhook. */
  private buildTools(req: OutboundCallRequest) {
    const tools: any[] = [];

    if (req.transfer?.destinations.length) {
      tools.push({
        type: 'transferCall',
        destinations: req.transfer.destinations.map((d) => ({
          type: 'number',
          number: d.number,
          description: d.label,
          message: req.transfer!.message,
        })),
        function: {
          name: 'transferCall',
          description:
            'Connect the caller to a human teammate right now. ' +
            req.transfer.instructions +
            ' Available people: ' +
            req.transfer.destinations.map((d) => `${d.label} (${d.number})`).join('; ') +
            '. Tell the caller who you are connecting them to by name.',
          parameters: {
            type: 'object',
            properties: {
              destination: {
                type: 'string',
                enum: req.transfer.destinations.map((d) => d.number),
                description:
                  'Number to transfer to. Pick the person whose role matches what the caller needs; otherwise the first one.',
              },
            },
            required: ['destination'],
          },
        },
      });
    }

    if (req.tools?.booking) {
      const server = {
        url: req.tools.webhookUrl,
        timeoutSeconds: 20,
        ...(req.credentials.webhookSecret ? { secret: req.credentials.webhookSecret } : {}),
      };
      tools.push({
        type: 'function',
        async: false,
        server,
        function: {
          name: 'book_appointment',
          description:
            'Book a meeting / demo / site visit with our team once the person agrees on a date and time. ' +
            'Confirm the exact date and time with them before calling this. ' +
            (req.tools.instructions || ''),
          parameters: {
            type: 'object',
            properties: {
              startTime: {
                type: 'string',
                description: `Meeting start as ISO 8601 with timezone offset, in the ${req.timezone} zone (e.g. 2026-10-02T11:00:00+05:30).`,
              },
              notes: { type: 'string', description: 'What the meeting is about, in one line.' },
              mode: { type: 'string', enum: ['call', 'video', 'in_person'], description: 'How they want to meet.' },
            },
            required: ['startTime'],
          },
        },
        messages: [
          { type: 'request-start', content: 'Ek second, main book kar deti hoon…' },
          { type: 'request-failed', content: 'I am noting the time down and our team will confirm the meeting with you shortly.' },
        ],
      });
      tools.push({
        type: 'function',
        async: false,
        server,
        function: {
          name: 'schedule_callback',
          description:
            'Schedule a callback when the person is busy now or wants to be called at a specific time. ' +
            'Confirm the exact date and time before calling this.',
          parameters: {
            type: 'object',
            properties: {
              callbackAt: {
                type: 'string',
                description: `Callback time as ISO 8601 with timezone offset, in the ${req.timezone} zone.`,
              },
              reason: { type: 'string', description: 'Why they want a callback / what to discuss.' },
            },
            required: ['callbackAt'],
          },
        },
        messages: [{ type: 'request-start', content: 'Okay, note kar rahi hoon…' }],
      });
    }

    return tools;
  }

  private buildAssistant(req: OutboundCallRequest, vars: Record<string, string>, server: any, metadata: any) {
    const a = req.assistant;
    const tools = this.buildTools(req);
    const voice = VOICE_PRESETS[a.voiceId] || { provider: a.voiceProvider || 'vapi', voiceId: a.voiceId || 'Neha' };
    return {
      name: `${a.agentName} (${a.companyName || 'LeadBells'})`.slice(0, 40),
      // Only the greeting is slowed - natural pauses after the name and the company
      // so the opening lands clearly; the rest of the call runs at normal pace
      firstMessage: slowGreeting(speakable(renderTemplate(a.firstMessage, vars))),
      firstMessageMode: 'assistant-speaks-first',
      model: {
        provider: 'openai',
        model: a.llmModel || 'gpt-4o-mini',
        // A little warmth: 0.4 reads as an IVR, 0.7 as a person who improvises
        temperature: 0.65,
        messages: [{ role: 'system', content: this.systemPrompt(req) }],
        ...(tools.length ? { tools } : {}),
      },
      voice,
      transcriber: LANGUAGE_TRANSCRIBER[a.language] || LANGUAGE_TRANSCRIBER['hi-en'],
      maxDurationSeconds: a.maxDurationSeconds || 420,
      silenceTimeoutSeconds: 30,
      // Let the lead cut in, and react quickly when they stop - the two things
      // that most separate a person from a menu
      startSpeakingPlan: { waitSeconds: 0.5, smartEndpointingEnabled: true },
      stopSpeakingPlan: { numWords: 2, voiceSeconds: 0.25, backoffSeconds: 1 },
      // Fill the think-time with a word instead of dead air
      responseDelaySeconds: 0.3,
      endCallFunctionEnabled: true,
      endCallMessage: 'Thank you so much for your time. Have a great day!',
      // Faint office ambience makes the line feel like a desk, not a server
      backgroundSound: 'off',
      backgroundDenoisingEnabled: true,
      voicemailDetection: {
        provider: 'twilio',
        enabled: true,
        voicemailDetectionTypes: ['machine_end_beep', 'machine_end_silence'],
      },
      voicemailMessage: renderTemplate(
        'Hi {{leadName}}, this is {{agentName}} from {{companyName}} about your recent enquiry. I will message you on WhatsApp - talk soon.',
        vars,
      ),
      artifactPlan: { recordingEnabled: true },
      analysisPlan: {
        summaryPlan: { enabled: true },
        structuredDataPlan: {
          enabled: true,
          schema: VAPI_STRUCTURED_DATA_SCHEMA,
          messages: [
            {
              role: 'system',
              content:
                'You will be given a sales call transcript. Extract the fields exactly as described. ' +
                'Dates must be ISO 8601 with timezone. If the person never spoke, outcome is no_answer. ' +
                'Only output JSON.\n\nJSON Schema:\n{{schema}}',
            },
            { role: 'user', content: 'Transcript:\n\n{{transcript}}' },
          ],
        },
      },
      serverMessages: ['end-of-call-report', 'status-update'],
      server,
      metadata,
    };
  }

  private leadContext(req: OutboundCallRequest): string {
    const l = req.lead;
    const lines = [`Name: ${l.name}`];
    if (l.company) lines.push(`Company: ${l.company}`);
    if (l.source) lines.push(`Came from: ${l.source}`);
    if (l.stage) lines.push(`Pipeline stage: ${l.stage}${l.temperature ? ` (${l.temperature} lead)` : ''}`);
    if (l.requirement) lines.push(`What they asked about: ${l.requirement}`);
    if (l.notes) lines.push(`Notes: ${l.notes}`);
    if (l.history) lines.push(`What happened before:\n${l.history}`);
    return lines.join('\n');
  }

  /** The goal of this particular call, from where the lead stands and why we are calling. */
  private callGoal(req: OutboundCallRequest): string {
    const stage = req.lead.stage || 'new';
    switch (req.reason) {
      case 'reengage':
        return 'RE-ENGAGEMENT CALL: they showed interest earlier but went quiet. Reconnect warmly, reference what was discussed before, find out what changed, and try to get a concrete next step. Do not repeat the full pitch.';
      case 'callback':
        return 'CALLBACK: they asked to be called at this time. Open with "you asked me to call you back", pick up exactly where the last conversation ended.';
      case 'retry':
        return 'RETRY: earlier attempts went unanswered. Keep it short and friendly; if it is a bad time, fix a callback.';
      case 'reschedule':
        return 'RESCHEDULE CALL: they missed the meeting we had booked (see history). No blame - say you noticed the meeting did not happen, ask if everything is okay, then offer two or three new slots and BOOK the new time with book_appointment before ending. If they are no longer interested, find out why and note it.';
    }
    switch (stage) {
      case 'new':
        return 'FIRST CALL: introduce yourself, confirm you have the right person, understand the need, qualify, agree the next step.';
      case 'contacted':
        return 'FOLLOW-UP: we already reached out once. Reference that, move the conversation toward a real requirement and a meeting.';
      case 'interested':
        return 'INTERESTED LEAD: they already want this. Do not re-pitch. Handle remaining questions, confirm budget/timeline, and BOOK A MEETING or hand them to a human.';
      case 'follow_up':
        return 'PENDING FOLLOW-UP: there is an open action from the last conversation (see history). Close that loop first, then push for the meeting.';
      case 'meeting':
        return 'MEETING STAGE: a meeting exists or was agreed. Confirm they are still coming, answer prep questions, reschedule if needed. Keep it under 2 minutes.';
      default:
        return 'Understand where they stand and agree the next step.';
    }
  }

  private systemPrompt(req: OutboundCallRequest): string {
    const a = req.assistant;
    const language =
      a.language === 'hi'
        ? 'Speak in natural Hindi.'
        : a.language === 'hi-en'
          ? 'Speak in natural Hinglish (Hindi-English mix, the way people talk in Indian offices). Switch fully to English if the person prefers it.'
          : 'Speak in clear, friendly English.';
    const questions = a.qualificationQuestions.length
      ? a.qualificationQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
      : '1. What are they looking for?\n2. When do they want to start?';

    return [
      `You are ${a.agentName}, a warm and professional sales representative at ${a.companyName || 'our company'}.`,
      'You are on an outbound phone call with a lead. Sound like a real person who remembers them, not a script.',
      '',
      `THIS CALL'S GOAL: ${this.callGoal(req)}`,
      '',
      `About what we offer:\n${a.offerSummary || 'Ask the lead what they enquired about and help them from there.'}`,
      '',
      `Lead context:\n${speakable(this.leadContext(req))}`,
      req.lead.brief ? `\nINSTRUCTIONS FOR THIS SPECIFIC LEAD (from our team - follow these over anything else):\n${req.lead.brief}` : '',
      req.playbook?.instructions ? `\nPlaybook "${req.playbook.name}":\n${req.playbook.instructions}` : '',
      '',
      `Find out, naturally, over the conversation (skip what you already know from the context):\n${questions}`,
      '',
      'HOW TO SOUND LIKE A PERSON (this matters more than anything else):',
      `- ${language}`,
      '- Talk the way a friendly, experienced salesperson talks on the phone - relaxed, warm, a little informal. Never like a recorded menu or a form being filled.',
      '- Short sentences. One question at a time. Then STOP and listen. Silence is fine.',
      '- The OPENING is slow and clear: say your name, pause, the company, pause, then one short question - and wait. After the greeting, talk at a normal, natural Indian conversational pace (the way people talk in an Indian office) - not slow, not rushed.',
      '- React to what they say before moving on ("Achha, clinic ke liye - nice.", "Got it.", "Makes sense."). Use small natural fillers sometimes: "hmm", "okay so", "right", "actually" - but not every sentence.',
      '- Use their name once or twice, not constantly. Mirror their energy: if they are brief, be brief.',
      '- If they interrupt, stop immediately and answer what they asked. If they did not hear you, rephrase - do not repeat word for word.',
      '- Vary your wording. Never say the same acknowledgement twice in a row. No "I understand your concern", no "certainly", no "as an AI".',
      '- Never read a list. Say things the way you would say them out loud.',
      '',
      'HOW TO SAY NUMBERS (the voice reads your text literally - write numbers as words):',
      '- Prices in words, Indian style: "twenty five thousand rupees", "one lakh fifty thousand", "around fifty k" - NEVER digits like 25000 or ₹25,000.',
      '- Times as spoken: "eleven thirty in the morning", "four pm", "kal subah gyarah baje". Dates: "Thursday, the second of October" - never 02/10.',
      '- Phone numbers digit by digit in small groups: "nine eight seven six five, four three two one zero".',
      '- Percentages: "twenty percent". Durations: "two to three weeks". Years: "twenty twenty six".',
      '',
      'Rules:',
      '- If they are busy, ask for a better time and confirm it clearly (date and time).',
      '- If they want a meeting or demo, propose a slot and confirm the exact date and time.',
      '- If they are not interested, thank them politely and end the call. Do not push.',
      '- Never invent prices, discounts or commitments. Say a specialist will confirm details.',
      '- A WhatsApp message goes to the customer automatically right after this call with whatever you promise. So you MAY say "I will send you these details on WhatsApp right after this call" - but ONLY for things you actually said on the call (prices, options, timings, address, next steps). Never promise documents, PDFs, quotes or links you do not have.',
      '- If this is a wrong number, apologise and end the call.',
      '- Keep the call under 5 minutes. Close by summarising the next step.',
      `- Today is ${new Date().toLocaleString('en-IN', { timeZone: req.timezone, dateStyle: 'full', timeStyle: 'short' })} (${req.timezone}). Convert "kal", "tomorrow", "next Monday" into real dates before booking anything.`,
      req.tools?.booking
        ? '- When a meeting/demo is agreed, confirm the exact date and time out loud, then call book_appointment. When they want a callback at a specific time, confirm it and call schedule_callback.' +
          (req.tools.instructions ? ` Booking rules: ${req.tools.instructions}` : '')
        : '',
      req.transfer?.destinations.length
        ? `- You can transfer the call to a human with transferCall. ${req.transfer.instructions} People you can transfer to: ${req.transfer.destinations.map((d) => d.label).join('; ')}. Say who you are connecting them to before you do.`
        : '',
      a.extraInstructions ? `\nAdditional instructions from the business:\n${a.extraInstructions}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  parseWebhook(body: any): VoiceCallEvent {
    const message = body?.message || body || {};
    const type = message.type;
    const call = message.call || {};
    const externalId = call.id || message.callId;

    if (type === 'tool-calls' || type === 'function-call') {
      // Newer payloads: toolCallList[{id,name,arguments}] (arguments may be a JSON string);
      // older ones: functionCall{name,parameters}
      const list: any[] = Array.isArray(message.toolCallList)
        ? message.toolCallList
        : Array.isArray(message.toolWithToolCallList)
          ? message.toolWithToolCallList.map((t: any) => t.toolCall).filter(Boolean)
          : message.functionCall
            ? [{ id: message.functionCall.id || 'fn', name: message.functionCall.name, arguments: message.functionCall.parameters }]
            : [];
      const toolCalls = list.map((t) => {
        let args = t.arguments ?? t.function?.arguments ?? {};
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch { args = {}; }
        }
        return { id: String(t.id || ''), name: String(t.name || t.function?.name || ''), arguments: args };
      });
      return { kind: 'tool-calls', externalId, toolCalls, raw: message };
    }

    if (type === 'status-update') {
      return {
        kind: 'status',
        externalId,
        status: message.status,
        endedReason: message.endedReason,
        raw: message,
      };
    }

    if (type === 'end-of-call-report') {
      const artifact = message.artifact || {};
      const msgs: any[] = artifact.messages || message.messages || [];
      const segments = msgs
        .filter(
          (m) =>
            m && (m.role === 'user' || m.role === 'bot' || m.role === 'assistant') && (m.message || m.content),
        )
        .map((m) => ({
          role: m.role === 'user' ? 'lead' : 'ai',
          text: String(m.message || m.content || ''),
          at: typeof m.secondsFromStart === 'number' ? m.secondsFromStart : undefined,
        }));
      const transcript: string =
        artifact.transcript ||
        message.transcript ||
        segments.map((s) => `${s.role === 'lead' ? 'Lead' : 'AI'}: ${s.text}`).join('\n');
      const analysis = message.analysis || {};
      const durationSeconds =
        typeof message.durationSeconds === 'number'
          ? message.durationSeconds
          : typeof message.durationMs === 'number'
            ? Math.round(message.durationMs / 1000)
            : message.startedAt && message.endedAt
              ? Math.max(0, Math.round((new Date(message.endedAt).getTime() - new Date(message.startedAt).getTime()) / 1000))
              : undefined;

      return {
        kind: 'ended',
        externalId,
        status: 'ended',
        endedReason: message.endedReason,
        startedAt: message.startedAt ? new Date(message.startedAt) : undefined,
        endedAt: message.endedAt ? new Date(message.endedAt) : undefined,
        durationSeconds,
        recordingUrl:
          artifact.recordingUrl ||
          message.recordingUrl ||
          artifact.stereoRecordingUrl ||
          message.stereoRecordingUrl,
        transcript,
        segments: segments.length ? segments : undefined,
        summary: analysis.summary || message.summary,
        structured:
          analysis.structuredData && typeof analysis.structuredData === 'object'
            ? analysis.structuredData
            : undefined,
        costUsd: typeof message.cost === 'number' ? message.cost : undefined,
        raw: message,
      };
    }

    return { kind: 'ignored', externalId, raw: message };
  }

  private async fetch(url: string, apiKey: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...((init.headers as Record<string, string>) || {}),
        },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Vapi did not answer within 20s');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
