export interface User {
  _id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'SALES_MANAGER' | 'SALESPERSON' | 'VIEWER';
  isActive: boolean;
  avatar?: string;
  phone?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  _id: string;
  name: string;
  slug: string;
  domain?: string;
  allowedOrigins: string[];
  branding?: { logo?: string; primaryColor?: string; favicon?: string };
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  limits: TenantLimits;
  settings?: { aiProvider?: string; aiModel?: string; timezone?: string; language?: string };
  notificationSettings?: TenantNotificationSettings;
  trialEndsAt?: string;
  createdAt: string;
}

export interface TenantNotificationSettings {
  emailOnNewLead?: boolean;
  emailOnHotLead?: boolean;
  emailOnHandoff?: boolean;
  slackWebhookUrl?: string;
  teamsWebhookUrl?: string;
  notifyRoles?: string[];
}

export interface TenantLimits {
  maxAgents: number;
  maxLeads: number;
  maxConversationsPerMonth: number;
  maxKnowledgeSources: number;
  maxUsers: number;
}

export interface Agent {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  welcomeMessage: string;
  aiConfig: { provider: string; model: string; temperature: number; maxTokens: number };
  widgetConfig: { primaryColor: string; headerText: string; placeholder: string; position: string; avatarUrl?: string };
  enabledTools: string[];
  leadCaptureFields: string[];
  handoffConfig?: { enabled: boolean; triggerKeywords: string[]; assignTo?: string; notifyChannels: string[] };
  status: 'active' | 'inactive' | 'draft';
  knowledgeSourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  _id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted' | 'lost';
  temperature: 'hot' | 'warm' | 'cold';
  score: number;
  source?: string;
  assignedTo?: string;
  customFields?: Record<string, any>;
  tags: string[];
  conversationIds: string[];
  metadata?: {
    url?: string; referrer?: string; utmSource?: string; utmMedium?: string;
    utmCampaign?: string; country?: string; city?: string;
  };
  lastActivityAt?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  _id: string;
  tenantId: string;
  agentId: string;
  leadId?: string;
  visitorId: string;
  status: 'active' | 'ended' | 'handed_off' | 'archived';
  mode: 'bot' | 'human' | 'hybrid';
  assignedUserId?: string;
  visitorInfo?: { ip?: string; userAgent?: string; country?: string; city?: string };
  messageCount: number;
  summary?: string;
  sentiment?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  sender: 'visitor' | 'bot' | 'agent';
  senderId?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system' | 'tool_result';
  createdAt: string;
}

export interface KnowledgeSource {
  _id: string;
  tenantId: string;
  name: string;
  type: 'file' | 'url' | 'text' | 'sitemap';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  sourceUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  chunkCount?: number;
  errorMessage?: string;
  lastProcessedAt?: string;
  createdAt: string;
}

export interface Notification {
  _id: string;
  title: string;
  body: string;
  type: string;
  channel: string;
  status: string;
  readAt?: string;
  data?: Record<string, any>;
  createdAt: string;
}

export interface Webhook {
  _id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  failureCount: number;
  createdAt: string;
}

export interface ApiKey {
  _id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface Handoff {
  _id: string;
  conversationId: string;
  agentId: string;
  assignedTo?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'expired';
  reason?: string;
  notes?: string;
  createdAt: string;
}

export interface SupportTicket {
  _id: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  leadId?: string;
  conversationId?: string;
  assignedTo?: string;
  createdAt: string;
}

export interface Appointment {
  _id: string;
  leadId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  attendee?: { name: string; email: string; phone?: string };
  meetingLink?: string;
  location?: string;
  createdAt: string;
}

export interface FollowUpWorkflow {
  _id: string;
  name: string;
  description?: string;
  trigger: string;
  triggerConditions?: Record<string, any>;
  steps: { order: number; delayMinutes: number; action: string; actionConfig: any }[];
  isActive: boolean;
  createdAt: string;
}

export interface Subscription {
  _id: string;
  plan: string;
  status: string;
  priceMonthly: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  plan: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface ScoringRule {
  _id: string;
  name: string;
  description?: string;
  condition: string;
  conditionConfig?: Record<string, any>;
  points: number;
  isActive: boolean;
  order: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface DashboardOverview {
  totalLeads: number;
  totalConversations: number;
  activeConversations: number;
  hotLeads: number;
  conversionRate: number;
  averageScore: number;
  pendingHandoffs: number;
  openTickets: number;
}
