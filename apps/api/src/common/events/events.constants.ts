/**
 * In-process platform events. Domain services emit these on the EventBus;
 * EventsListenerService (webhooks, notifications, sockets, scoring) and
 * FollowUpService (workflow triggers) subscribe to them.
 */
export const PlatformEvents = {
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_SCORED: 'lead.scored',
  LEAD_DELETED: 'lead.deleted',

  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_ENDED: 'conversation.ended',
  MESSAGE_CREATED: 'message.created',

  HANDOFF_CREATED: 'handoff.created',
  HANDOFF_ACCEPTED: 'handoff.accepted',
  HANDOFF_REJECTED: 'handoff.rejected',
  HANDOFF_COMPLETED: 'handoff.completed',

  APPOINTMENT_CREATED: 'appointment.created',
  APPOINTMENT_UPDATED: 'appointment.updated',
} as const;

export type PlatformEvent = (typeof PlatformEvents)[keyof typeof PlatformEvents];

export interface LeadChanges {
  status?: { from: string; to: string };
  assignedTo?: { from?: string; to?: string };
  temperature?: { from: string; to: string };
}

export interface LeadCreatedPayload {
  tenantId: string;
  lead: any;
  conversationId?: string;
}

export interface LeadUpdatedPayload {
  tenantId: string;
  lead: any;
  changes: LeadChanges;
  performedBy?: string;
}

export interface LeadScoredPayload {
  tenantId: string;
  lead: any;
  oldScore: number;
  oldTemperature: string;
  appliedRules: { rule: string; points: number }[];
}

export interface LeadDeletedPayload {
  tenantId: string;
  leadId: string;
}

export interface ConversationPayload {
  tenantId: string;
  conversation: any;
}

export interface MessageCreatedPayload {
  tenantId: string;
  conversationId: string;
  message: any;
}

export interface HandoffPayload {
  tenantId: string;
  handoff: any;
  conversation?: any;
}

export interface AppointmentPayload {
  tenantId: string;
  appointment: any;
}
