/**
 * Centralized Subscription Plans & Entitlements Configuration
 * Source of truth for BizMate SaaS monetization.
 */
export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free Tier',
    price: 0,
    annual_price: 0,
    currency: 'INR',
    billing_interval: 'month',
    badge: 'Free',
    description: 'Essential business tools for micro-enterprises and initial setup.',
    limits: {
      ai_operations_monthly: 50,
      crm_contacts: 100,
      staff_accounts: 1,
      automation_workflows: 1,
      voice_processing: false,
      voice_seconds_monthly: 0,
      storage_mb: 250,
    },
    features: {
      basic_crm: true,
      basic_dashboard: true,
      whatsapp_inbox: true,
      advanced_ai_copilot: false,
      voice_notes: false,
      advanced_analytics: false,
      priority_support: false,
      custom_integrations: false,
    },
    display_highlights: [
      '50 AI operations / mo',
      '100 CRM Contacts',
      '1 Staff Account',
      '1 Active Automation Workflow',
      'WhatsApp Shared Inbox',
      'Basic CRM & Dashboard',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 599,
    annual_price: 5990, // ~17% annual discount
    currency: 'INR',
    billing_interval: 'month',
    badge: 'Starter',
    description: 'Designed for single-location retail shops, salons, and boutique cafes.',
    limits: {
      ai_operations_monthly: 500,
      crm_contacts: 1000,
      staff_accounts: 2,
      automation_workflows: 3,
      voice_processing: true,
      voice_seconds_monthly: 300, // 5 minutes of audio
      storage_mb: 1000,
    },
    features: {
      basic_crm: true,
      basic_dashboard: true,
      whatsapp_inbox: true,
      advanced_ai_copilot: false,
      voice_notes: true,
      advanced_analytics: false,
      priority_support: false,
      custom_integrations: false,
    },
    display_highlights: [
      '500 AI operations / mo',
      '1,000 CRM Contacts',
      '2 Staff Accounts',
      '3 Active Automation Workflows',
      'Basic AI Copilot',
      'Limited Voice Note Processing (5 mins)',
      'Basic Business Analytics',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 1499,
    annual_price: 14990,
    currency: 'INR',
    billing_interval: 'month',
    badge: 'Popular',
    description: 'For growing businesses requiring AI autopilot and multilingual customer operations.',
    limits: {
      ai_operations_monthly: 2500,
      crm_contacts: 10000,
      staff_accounts: 5,
      automation_workflows: 10,
      voice_processing: true,
      voice_seconds_monthly: 1800, // 30 minutes of audio
      storage_mb: 5000,
    },
    features: {
      basic_crm: true,
      basic_dashboard: true,
      whatsapp_inbox: true,
      advanced_ai_copilot: true,
      voice_notes: true,
      advanced_analytics: true,
      priority_support: false,
      custom_integrations: false,
    },
    display_highlights: [
      '2,500 AI operations / mo',
      '10,000 CRM Contacts',
      '5 Staff Accounts',
      '10 Active Automation Workflows',
      'Advanced AI Copilot & Autopilot',
      'Full Voice Note Understanding (30 mins)',
      'Advanced Revenue & Conversion Analytics',
      'Multi-Industry Automation Rules',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro Scale',
    price: 3499,
    annual_price: 34990,
    currency: 'INR',
    billing_interval: 'month',
    badge: 'Scale',
    description: 'For high-volume operations, established restaurant chains, and large service teams.',
    limits: {
      ai_operations_monthly: 10000,
      crm_contacts: 50000,
      staff_accounts: 15,
      automation_workflows: 50, // Fair-use cap
      voice_processing: true,
      voice_seconds_monthly: 6000, // 100 minutes of audio
      storage_mb: 20000,
    },
    features: {
      basic_crm: true,
      basic_dashboard: true,
      whatsapp_inbox: true,
      advanced_ai_copilot: true,
      voice_notes: true,
      advanced_analytics: true,
      priority_support: true,
      custom_integrations: false,
    },
    display_highlights: [
      '10,000 AI operations / mo',
      '50,000 CRM Contacts',
      '15 Staff Accounts',
      'Up to 50 Automation Workflows',
      'High-Volume Voice Processing (100 mins)',
      'Priority Support SLA',
      'Advanced Analytics & Custom Exports',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null, // Custom quote
    annual_price: null,
    currency: 'INR',
    billing_interval: 'month',
    badge: 'Custom',
    description: 'Custom quotas, dedicated infrastructure, and SLA for multi-outlet franchises.',
    limits: {
      ai_operations_monthly: 50000,
      crm_contacts: 100000,
      staff_accounts: 50,
      automation_workflows: 100,
      voice_processing: true,
      voice_seconds_monthly: 18000,
      storage_mb: 100000,
    },
    features: {
      basic_crm: true,
      basic_dashboard: true,
      whatsapp_inbox: true,
      advanced_ai_copilot: true,
      voice_notes: true,
      advanced_analytics: true,
      priority_support: true,
      custom_integrations: true,
    },
    display_highlights: [
      'Custom / Negotiated AI Quotas',
      '100,000+ CRM Contacts',
      '50+ Staff Accounts',
      'Unlimited Workflows (Fair Use)',
      'Multi-Location Central Control',
      'Dedicated Account Manager & SLA',
      'Custom Retention & Storage Policies',
    ],
  },
};

/**
 * Returns plan definition or falls back to 'free'
 */
export function getPlanConfig(planId) {
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;
}

/**
 * Formats plans for public consumption
 */
export function listPublicPlans() {
  return Object.values(SUBSCRIPTION_PLANS).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    annual_price: p.annual_price,
    currency: p.currency,
    billing_interval: p.billing_interval,
    badge: p.badge,
    description: p.description,
    limits: p.limits,
    features: p.features,
    highlights: p.display_highlights,
  }));
}
