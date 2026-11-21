-- BizMate Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Businesses (Tenants)
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    industry_id VARCHAR(50) NOT NULL,
    phone_number VARCHAR(50),
    email VARCHAR(255),
    plan_id VARCHAR(50) DEFAULT 'growth',
    gstin VARCHAR(20),
    currency VARCHAR(10) DEFAULT 'INR',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    settings JSONB DEFAULT '{}'::jsonb,
    ai_config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users (Store Owners & Staff)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'owner',
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Customers (CRM Leads)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'lead',
    lead_score INT DEFAULT 75,
    preferred_language VARCHAR(50) DEFAULT 'en',
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}'::jsonb,
    outstanding_balance NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_biz ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- 4. WhatsApp Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel VARCHAR(50) DEFAULT 'whatsapp',
    is_locked_by_human BOOLEAN DEFAULT FALSE,
    assigned_to_user_id UUID,
    detected_language VARCHAR(50) DEFAULT 'Hinglish',
    current_intent VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    unread_count INT DEFAULT 0,
    last_message_content TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_biz ON conversations(business_id);

-- 5. Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- customer, ai, human
    content TEXT,
    translated_content TEXT,
    detected_language VARCHAR(50) DEFAULT 'English',
    media_url TEXT,
    media_type VARCHAR(50) DEFAULT 'text',
    transcription TEXT,
    whatsapp_message_id VARCHAR(255),
    intent VARCHAR(100),
    entities JSONB DEFAULT '{}'::jsonb,
    delivery_status VARCHAR(50) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

-- 6. WhatsApp Accounts (Meta Settings)
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    waba_id VARCHAR(100),
    phone_number_id VARCHAR(100) NOT NULL,
    access_token TEXT NOT NULL,
    verify_token VARCHAR(255) NOT NULL,
    app_secret VARCHAR(255),
    connection_status VARCHAR(50) DEFAULT 'connected',
    is_connected BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. WhatsApp Webhook Events (Idempotency)
CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    whatsapp_message_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(50) DEFAULT 'message',
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Appointments & Bookings
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    slot TIMESTAMP WITH TIME ZONE,
    service_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Operations & Products
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    stock_quantity NUMERIC(10, 2) DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'kg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. GST Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(50) PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    cgst NUMERIC(10, 2) NOT NULL,
    sgst NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'paid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_biz ON invoices(business_id);

-- 11. Orders & Transactions
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_number VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'completed',
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_biz ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_biz ON appointments(business_id);

-- Seed Primary Business (Demo / Production initial tenant)
INSERT INTO businesses (id, name, industry_id, phone_number, email, plan_id, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Spicy Bistro & Cafe',
    'restaurants',
    '+919811234567',
    'owner@spicybistro.com',
    'growth',
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- Seed Demo User (password is bcrypt for 'password123')
INSERT INTO users (id, email, hashed_password, full_name, role, business_id, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'owner@spicybistro.com',
    '$2a$10$7bMsMH453/Bn3Rt459j4fuIeG3RVc2PELgzLSe3B6fbbDeHZ4Ar5e',
    'Aditya Kumbhar',
    'owner',
    '00000000-0000-0000-0000-000000000001',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Seed Sample CRM Customers
INSERT INTO customers (id, business_id, name, phone, email, status, lead_score, outstanding_balance)
VALUES 
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Rahul Sharma', '+91 98112 34567', 'rahul@gmail.com', 'qualified', 92, 4500.00),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Pooja Mehta', '+91 97234 56789', 'pooja@gmail.com', 'contacted', 78, 1200.00),
    ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'Vikram Patel', '+91 99887 66554', 'vikram@gmail.com', 'converted', 85, 12000.00),
    ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'Ananya Iyer', '+91 98770 11223', 'ananya@gmail.com', 'new', 64, 0.00)
ON CONFLICT (id) DO NOTHING;
