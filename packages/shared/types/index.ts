// User Roles
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SALES_MANAGER' | 'SALESPERSON' | 'VIEWER';

// Lead
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted' | 'lost';
export type LeadTemperature = 'hot' | 'warm' | 'cold';
export type LeadSource = 'widget' | 'api' | 'import' | 'manual' | 'referral';

// Conversation
export type ConversationStatus = 'active' | 'closed' | 'handed_off' | 'waiting';
export type MessageSender = 'visitor' | 'bot' | 'agent';

// Knowledge Base
export type KnowledgeSourceType = 'text' | 'url' | 'file' | 'sitemap';
export type KnowledgeSourceStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Notification
export type NotificationChannel = 'email' | 'in_app' | 'slack' | 'sms' | 'whatsapp' | 'teams' | 'push';
export type NotificationType =
  | 'new_lead'
  | 'handoff_request'
  | 'follow_up'
  | 'appointment_reminder'
  | 'system'
  | 'billing';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read';

// Handoff
export type HandoffStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'expired';

// Support Ticket
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

// Appointment
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

// Follow-up
export type FollowUpAction =
  | 'send_email'
  | 'send_sms'
  | 'send_whatsapp'
  | 'notify_salesperson'
  | 'change_status'
  | 'assign_lead';
export type FollowUpTrigger =
  | 'lead_created'
  | 'lead_status_changed'
  | 'lead_score_changed'
  | 'conversation_ended'
  | 'no_response';

// Billing
export type PlanType = 'free' | 'starter' | 'professional' | 'enterprise';
export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

// Webhook
export type WebhookEvent =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.qualified'
  | 'conversation.started'
  | 'conversation.ended'
  | 'handoff.created'
  | 'appointment.created';

// Scoring
export type ScoringConditionField =
  | 'email'
  | 'phone'
  | 'company'
  | 'source'
  | 'page_views'
  | 'messages_sent'
  | 'time_on_site';

// API Response
export interface ApiResponse<T> {
  data: T;
  message?: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
