/**
 * Contract for a hosted AI voice provider. Vapi is the first implementation;
 * Retell / Bland would map onto the same shape.
 */

export interface OutboundCallRequest {
  tenantId: string;
  callId: string;
  toNumber: string;
  lead: {
    id: string;
    name: string;
    firstName?: string;
    company?: string;
    email?: string;
    source?: string;
    requirement?: string;
    notes?: string;
    /** Pipeline stage + temperature so the agent knows where this lead stands. */
    stage?: string;
    temperature?: string;
    /** What happened before: previous call summaries, objections, pending tasks, meetings. */
    history?: string;
    /** Instructions a human wrote for THIS lead ("AI call brief"). */
    brief?: string;
    /** Language override for this lead (en | hi | hi-en). */
    language?: string;
  };
  /** Lead-type script overrides picked by settings.playbooks. */
  playbook?: {
    name: string;
    agentName?: string;
    language?: string;
    firstMessage?: string;
    instructions?: string;
  };
  /** Already resolved through the credential vault. */
  credentials: Record<string, string>;
  /** Public URL the provider posts call events to. */
  webhookUrl: string;
  /** What the agent should sound like and ask. */
  assistant: {
    agentName: string;
    /** auto | female | male - drives Hindi verb gender in the prompt. */
    agentGender?: string;
    companyName: string;
    offerSummary: string;
    extraInstructions: string;
    firstMessage: string;
    qualificationQuestions: string[];
    language: string;
    voiceProvider: string;
    voiceId: string;
    llmModel: string;
    maxDurationSeconds: number;
  };
  /** 'new_lead' | 'retry' | 'callback' | 'reengage' | 'manual' | 'workflow' | 'test' */
  reason: string;
  /** Tenant timezone, so "tomorrow 11am" resolves correctly. */
  timezone: string;
  /** Live transfer destinations, in order of preference. Empty = no transfer tool. */
  transfer?: {
    destinations: { number: string; label: string }[];
    message: string;
    instructions: string;
  };
  /** In-call tools (book_appointment, schedule_callback) post here. */
  tools?: {
    webhookUrl: string;
    booking: boolean;
    meetingDurationMinutes: number;
    instructions: string;
  };
}

export interface OutboundCallResult {
  externalId: string;
  status: string;
  raw?: any;
}

/** A function the assistant invoked mid-call; we must answer synchronously. */
export interface VoiceToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/** Normalised webhook event, whatever the vendor's payload looks like. */
export interface VoiceCallEvent {
  kind: 'status' | 'ended' | 'tool-calls' | 'ignored';
  externalId?: string;
  toolCalls?: VoiceToolCall[];
  status?: string;
  endedReason?: string;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  recordingUrl?: string;
  transcript?: string;
  segments?: { role: string; text: string; at?: number }[];
  summary?: string;
  structured?: Record<string, any>;
  costUsd?: number;
  raw?: any;
}

export interface IVoiceProvider {
  readonly id: string;
  /** True when the credentials contain everything needed to dial. */
  isConfigured(credentials: Record<string, string>): boolean;
  startOutboundCall(req: OutboundCallRequest): Promise<OutboundCallResult>;
  parseWebhook(body: any): VoiceCallEvent;
}
