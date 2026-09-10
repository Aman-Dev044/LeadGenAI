export interface PlanLimits {
  maxAgents: number;
  maxLeads: number;
  maxConversationsPerMonth: number;
  maxKnowledgeSources: number;
  maxUsers: number;
}

export const PLANS = ['free', 'starter', 'professional', 'enterprise'] as const;
export type PlanName = (typeof PLANS)[number];

export const DEFAULT_PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: { maxAgents: 1, maxLeads: 100, maxConversationsPerMonth: 500, maxKnowledgeSources: 5, maxUsers: 2 },
  starter: { maxAgents: 3, maxLeads: 1000, maxConversationsPerMonth: 2000, maxKnowledgeSources: 20, maxUsers: 5 },
  professional: { maxAgents: 10, maxLeads: 10000, maxConversationsPerMonth: 5000, maxKnowledgeSources: 50, maxUsers: 20 },
  enterprise: { maxAgents: 100, maxLeads: 1000000, maxConversationsPerMonth: 1000000, maxKnowledgeSources: 500, maxUsers: 500 },
};

/** Feature flags the owner can toggle globally or per tenant. */
export const KNOWN_FEATURE_FLAGS: { key: string; label: string; description: string; default: boolean }[] = [
  { key: 'aiSummaries', label: 'AI conversation summaries', description: 'Auto-summarise conversations and leads with the LLM.', default: true },
  { key: 'followUps', label: 'Follow-up automation', description: 'Email / SMS / WhatsApp follow-up workflows.', default: true },
  { key: 'appointments', label: 'Appointment booking', description: 'Let the AI agent book meetings.', default: true },
  { key: 'supportTickets', label: 'Support tickets', description: 'Ticket creation from chat.', default: true },
  { key: 'webhooks', label: 'Outgoing webhooks', description: 'Send platform events to customer URLs.', default: true },
  { key: 'apiKeys', label: 'Public API keys', description: 'Programmatic access to the tenant API.', default: true },
  { key: 'visitorTracking', label: 'Visitor tracking', description: 'Page-view and attribution tracking.', default: true },
  { key: 'anthropicProvider', label: 'Anthropic models', description: 'Allow agents to use Claude models.', default: true },
  { key: 'betaFeatures', label: 'Beta features', description: 'Early access to experimental features.', default: false },
];

export const DEFAULT_RESERVED_SLUGS = [
  'owner', 'admin', 'superadmin', 'super-admin', 'api', 'www', 'app', 'platform', 'system', 'root', 'support', 'billing',
];
