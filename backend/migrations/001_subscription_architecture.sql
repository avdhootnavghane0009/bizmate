-- Migration 001: Subscription & Entitlement Architecture
-- BizMate SaaS Monetization Framework

-- 1. Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2),
    annual_price NUMERIC(10, 2),
    currency VARCHAR(10) DEFAULT 'INR',
    billing_interval VARCHAR(20) DEFAULT 'month',
    limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Subscription Plans
INSERT INTO subscription_plans (id, name, price, annual_price, currency, limits, features)
VALUES 
    (
      'free', 
      'Free Tier', 
      0.00, 
      0.00, 
      'INR', 
      '{"ai_operations_monthly": 50, "crm_contacts": 100, "staff_accounts": 1, "automation_workflows": 1, "voice_processing": false, "voice_seconds_monthly": 0, "storage_mb": 250}'::jsonb,
      '{"basic_crm": true, "basic_dashboard": true, "whatsapp_inbox": true, "advanced_ai_copilot": false, "voice_notes": false, "advanced_analytics": false, "priority_support": false}'::jsonb
    ),
    (
      'starter', 
      'Starter', 
      599.00, 
      5990.00, 
      'INR', 
      '{"ai_operations_monthly": 500, "crm_contacts": 1000, "staff_accounts": 2, "automation_workflows": 3, "voice_processing": true, "voice_seconds_monthly": 300, "storage_mb": 1000}'::jsonb,
      '{"basic_crm": true, "basic_dashboard": true, "whatsapp_inbox": true, "advanced_ai_copilot": false, "voice_notes": true, "advanced_analytics": false, "priority_support": false}'::jsonb
    ),
    (
      'growth', 
      'Growth', 
      1499.00, 
      14990.00, 
      'INR', 
      '{"ai_operations_monthly": 2500, "crm_contacts": 10000, "staff_accounts": 5, "automation_workflows": 10, "voice_processing": true, "voice_seconds_monthly": 1800, "storage_mb": 5000}'::jsonb,
      '{"basic_crm": true, "basic_dashboard": true, "whatsapp_inbox": true, "advanced_ai_copilot": true, "voice_notes": true, "advanced_analytics": true, "priority_support": false}'::jsonb
    ),
    (
      'pro', 
      'Pro Scale', 
      3499.00, 
      34990.00, 
      'INR', 
      '{"ai_operations_monthly": 10000, "crm_contacts": 50000, "staff_accounts": 15, "automation_workflows": 50, "voice_processing": true, "voice_seconds_monthly": 6000, "storage_mb": 20000}'::jsonb,
      '{"basic_crm": true, "basic_dashboard": true, "whatsapp_inbox": true, "advanced_ai_copilot": true, "voice_notes": true, "advanced_analytics": true, "priority_support": true}'::jsonb
    ),
    (
      'enterprise', 
      'Enterprise', 
      NULL, 
      NULL, 
      'INR', 
      '{"ai_operations_monthly": 50000, "crm_contacts": 100000, "staff_accounts": 50, "automation_workflows": 100, "voice_processing": true, "voice_seconds_monthly": 18000, "storage_mb": 100000}'::jsonb,
      '{"basic_crm": true, "basic_dashboard": true, "whatsapp_inbox": true, "advanced_ai_copilot": true, "voice_notes": true, "advanced_analytics": true, "priority_support": true, "custom_integrations": true}'::jsonb
    )
ON CONFLICT (id) DO UPDATE 
SET 
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  annual_price = EXCLUDED.annual_price,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features;

-- 2. Business Subscriptions Table
CREATE TABLE IF NOT EXISTS business_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(50) NOT NULL DEFAULT 'free', 
    -- Allowed statuses: 'free', 'trialing', 'active', 'past_due', 'cancelled', 'expired', 'suspended'
    payment_provider VARCHAR(50) DEFAULT 'none',
    external_subscription_id VARCHAR(255),
    external_customer_id VARCHAR(255),
    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    billing_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    billing_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    trial_ends_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_sub_biz ON business_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_business_sub_status ON business_subscriptions(status);

-- 3. Subscription Payments Table
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES business_subscriptions(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    payment_provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    provider_payment_id VARCHAR(255),
    provider_order_id VARCHAR(255),
    provider_signature VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Allowed statuses: 'pending', 'successful', 'failed', 'refunded'
    error_code VARCHAR(100),
    error_description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_payments_biz ON subscription_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_order ON subscription_payments(provider_order_id);

-- 4. Subscription Events Table (Idempotency and Audit Trail)
CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    provider VARCHAR(50) DEFAULT 'razorpay',
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Subscription Invoices Table (BizMate SaaS Invoices)
CREATE TABLE IF NOT EXISTS subscription_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES business_subscriptions(id) ON DELETE SET NULL,
    plan_id VARCHAR(50) NOT NULL REFERENCES subscription_plans(id),
    amount NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'paid',
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    invoice_pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_invoices_biz ON subscription_invoices(business_id);

-- 6. Update businesses table default plan to 'free'
ALTER TABLE businesses ALTER COLUMN plan_id SET DEFAULT 'free';

-- 7. Initialize business_subscriptions for all existing businesses
INSERT INTO business_subscriptions (business_id, plan_id, status, payment_provider, billing_period_start, billing_period_end)
SELECT 
    b.id,
    COALESCE(b.plan_id, 'free'),
    CASE 
      WHEN b.plan_id IN ('starter', 'growth', 'pro', 'enterprise') THEN 'active'
      ELSE 'free'
    END,
    'legacy_initial',
    NOW(),
    NOW() + INTERVAL '30 days'
FROM businesses b
ON CONFLICT (business_id) DO NOTHING;
