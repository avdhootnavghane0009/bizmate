-- Migration 002: Real-time Usage Metering & Cost Tracking Architecture
-- BizMate SaaS Monetization Framework

-- 1. Tenant Usage Aggregate Table (Per Billing Period)
CREATE TABLE IF NOT EXISTS tenant_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    billing_cycle_start TIMESTAMPTZ NOT NULL,
    billing_cycle_end TIMESTAMPTZ NOT NULL,
    ai_credits_used NUMERIC(10, 2) DEFAULT 0.00,
    gemini_requests INT DEFAULT 0,
    gemini_input_tokens BIGINT DEFAULT 0,
    gemini_output_tokens BIGINT DEFAULT 0,
    gemini_total_tokens BIGINT DEFAULT 0,
    audio_seconds_processed INT DEFAULT 0,
    estimated_ai_cost_usd NUMERIC(10, 6) DEFAULT 0.000000,
    estimated_ai_cost_inr NUMERIC(10, 4) DEFAULT 0.0000,
    whatsapp_inbound_count INT DEFAULT 0,
    whatsapp_outbound_count INT DEFAULT 0,
    whatsapp_service_conversations INT DEFAULT 0,
    whatsapp_utility_messages INT DEFAULT 0,
    whatsapp_marketing_messages INT DEFAULT 0,
    whatsapp_auth_messages INT DEFAULT 0,
    automation_executions INT DEFAULT 0,
    storage_bytes_used BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_business_billing_period UNIQUE (business_id, billing_cycle_start)
);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_biz ON tenant_usage(business_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_cycle ON tenant_usage(billing_cycle_start, billing_cycle_end);

-- 2. Granular Usage Events Table (Immutable Audit Ledger)
CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'ai_operation', 'whatsapp_inbound', 'whatsapp_outbound', 'automation_execution', 'media_upload'
    operation_name VARCHAR(100) NOT NULL, -- 'detect_and_translate', 'extract_intent_and_entities', 'transcribe_voice_note', 'copilot_parse_instruction'
    credits_consumed NUMERIC(6, 2) DEFAULT 1.00,
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    duration_seconds NUMERIC(8, 2) DEFAULT 0.00,
    model_used VARCHAR(100),
    estimated_cost_usd NUMERIC(10, 6) DEFAULT 0.000000,
    estimated_cost_inr NUMERIC(10, 4) DEFAULT 0.0000,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_biz ON usage_events(business_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at);

-- 3. Populate initial tenant_usage rows for existing businesses based on current subscription dates
INSERT INTO tenant_usage (business_id, billing_cycle_start, billing_cycle_end, created_at, updated_at)
SELECT 
    bs.business_id,
    COALESCE(bs.billing_period_start, NOW()),
    COALESCE(bs.billing_period_end, NOW() + INTERVAL '30 days'),
    NOW(),
    NOW()
FROM business_subscriptions bs
ON CONFLICT (business_id, billing_cycle_start) DO NOTHING;
