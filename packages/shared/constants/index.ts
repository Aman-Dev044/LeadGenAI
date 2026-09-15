// User Roles: Platform owner is SUPER_ADMIN. Workspace roles are strictly ADMIN and SALESPERSON.
export const USER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SALESPERSON'] as const;

// Lead Statuses
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'] as const;
export const LEAD_TEMPERATURES = ['hot', 'warm', 'cold'] as const;

// Conversation
export const CONVERSATION_STATUSES = ['active', 'closed', 'handed_off', 'waiting'] as const;

// Knowledge Source
export const KNOWLEDGE_SOURCE_TYPES = ['text', 'url', 'file', 'sitemap'] as const;

// Notification Channels
export const NOTIFICATION_CHANNELS = ['email', 'in_app', 'slack', 'sms', 'whatsapp', 'teams', 'push'] as const;

// Plans
export const PLANS = {
  free: {
    name: 'Free',
    agents: 1,
    conversations: 100,
    leads: 50,
    knowledgeSources: 3,
    users: 2,
  },
  starter: {
    name: 'Starter',
    agents: 3,
    conversations: 1000,
    leads: 500,
    knowledgeSources: 10,
    users: 5,
  },
  professional: {
    name: 'Professional',
    agents: 10,
    conversations: 10000,
    leads: 5000,
    knowledgeSources: 50,
    users: 20,
  },
  enterprise: {
    name: 'Enterprise',
    agents: -1, // unlimited
    conversations: -1,
    leads: -1,
    knowledgeSources: -1,
    users: -1,
  },
} as const;

// API Endpoints (for frontend)
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    PROFILE: '/auth/profile',
  },
  AGENTS: '/agents',
  LEADS: '/leads',
  CONVERSATIONS: '/conversations',
  KNOWLEDGE_BASE: '/knowledge-base',
  NOTIFICATIONS: '/notifications',
  WEBHOOKS: '/webhooks',
  API_KEYS: '/api-keys',
  ANALYTICS: '/analytics',
  DASHBOARD: '/dashboard',
  USERS: '/users',
  BILLING: '/billing',
  APPOINTMENTS: '/appointments',
  FOLLOW_UPS: '/follow-ups',
  HANDOFFS: '/handoffs',
  SUPPORT_TICKETS: '/support-tickets',
  VISITOR_TRACKING: '/visitor-tracking',
  SETTINGS: '/tenant/settings',
} as const;

// Webhook Events
export const WEBHOOK_EVENTS = [
  'lead.created',
  'lead.updated',
  'lead.qualified',
  'conversation.started',
  'conversation.ended',
  'handoff.created',
  'appointment.created',
] as const;
