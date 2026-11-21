import test from 'node:test';
import assert from 'node:assert';
import app from '../app.js';
import { query } from '../config/database.js';
import { UsageService } from '../services/usageService.js';
import { EntitlementService } from '../services/entitlementService.js';
import { calculateGeminiCost, COST_CONSTANTS } from '../config/costConstants.js';
import { v4 as uuidv4 } from 'uuid';

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (server) server.close();
});

test('TEST 1: Gemini Token & Cost Metering Engine', async () => {
  const bizId = uuidv4();
  await query(
    `INSERT INTO businesses (id, name, industry_id, phone_number, email, plan_id, is_active)
     VALUES ($1, 'Token Meter Cafe', 'restaurants', '+919111100001', 'token@test.com', 'starter', true)`,
    [bizId]
  );
  await query(
    `INSERT INTO business_subscriptions (id, business_id, plan_id, status, billing_period_start, billing_period_end)
     VALUES (gen_random_uuid(), $1, 'starter', 'active', NOW(), NOW() + INTERVAL '30 days')`,
    [bizId]
  );

  // Record an AI operation with 200 input tokens and 60 output tokens
  const recordResult = await UsageService.recordAiOperation(bizId, {
    operationName: 'extract_intent_and_entities',
    model: 'gemini-3.5-flash-lite',
    promptTokens: 200,
    completionTokens: 60,
    durationSeconds: 1.2,
    metadata: { test: true },
  });

  assert(recordResult, 'Should return record metadata');
  assert.strictEqual(recordResult.credits_consumed, 1.0);
  assert.strictEqual(recordResult.total_tokens, 260);

  // Verify immutable entry in usage_events
  const eventDb = await query(
    'SELECT * FROM usage_events WHERE id = $1',
    [recordResult.event_id]
  );
  assert.strictEqual(eventDb.rows.length, 1);
  assert.strictEqual(eventDb.rows[0].input_tokens, 200);
  assert.strictEqual(eventDb.rows[0].output_tokens, 60);
  assert.strictEqual(eventDb.rows[0].model_used, 'gemini-3.5-flash-lite');

  // Verify aggregate in tenant_usage
  const usageDb = await query(
    'SELECT * FROM tenant_usage WHERE business_id = $1',
    [bizId]
  );
  assert.strictEqual(usageDb.rows.length, 1);
  assert.strictEqual(parseInt(usageDb.rows[0].gemini_requests), 1);
  assert.strictEqual(parseInt(usageDb.rows[0].gemini_input_tokens), 200);
  assert.strictEqual(parseInt(usageDb.rows[0].gemini_output_tokens), 60);
  assert.strictEqual(parseFloat(usageDb.rows[0].ai_credits_used), 1.0);
});

test('TEST 2: Transparent AI Operation Credit Weights', async () => {
  const bizId = uuidv4();
  await query(
    `INSERT INTO businesses (id, name, industry_id, phone_number, email, plan_id, is_active)
     VALUES ($1, 'Credit Weight Salon', 'salons', '+919111100002', 'weight@test.com', 'growth', true)`,
    [bizId]
  );
  await query(
    `INSERT INTO business_subscriptions (id, business_id, plan_id, status, billing_period_start, billing_period_end)
     VALUES (gen_random_uuid(), $1, 'growth', 'active', NOW(), NOW() + INTERVAL '30 days')`,
    [bizId]
  );

  // 1. Language detection (0.5 credit)
  await UsageService.recordAiOperation(bizId, {
    operationName: 'detect_and_translate',
    promptTokens: 100,
    completionTokens: 30,
  });

  // 2. Intent extraction (1.0 credit)
  await UsageService.recordAiOperation(bizId, {
    operationName: 'extract_intent_and_entities',
    promptTokens: 150,
    completionTokens: 50,
  });

  // 3. Voice note transcription (2.0 credits)
  await UsageService.recordAiOperation(bizId, {
    operationName: 'transcribe_voice_note',
    promptTokens: 400,
    completionTokens: 80,
    durationSeconds: 15,
  });

  const usage = await UsageService.getTenantUsage(bizId);
  // Total credits = 0.5 + 1.0 + 2.0 = 3.5 credits
  assert.strictEqual(usage.ai_credits.used, 3.5);
  assert.strictEqual(usage.ai_credits.requests_count, 3);
  assert.strictEqual(usage.ai_credits.audio_seconds, 15);
});

test('TEST 3: WhatsApp Inbound & Outbound Categorization (BYOC Separation)', async () => {
  const bizId = uuidv4();
  await query(
    `INSERT INTO businesses (id, name, industry_id, phone_number, email, plan_id, is_active)
     VALUES ($1, 'WhatsApp Tracking Store', 'retail', '+919111100003', 'wa_track@test.com', 'starter', true)`,
    [bizId]
  );
  await query(
    `INSERT INTO business_subscriptions (id, business_id, plan_id, status, billing_period_start, billing_period_end)
     VALUES (gen_random_uuid(), $1, 'starter', 'active', NOW(), NOW() + INTERVAL '30 days')`,
    [bizId]
  );

  // Inbound customer service conversation
  await UsageService.recordWhatsAppMessage(bizId, {
    direction: 'inbound',
    category: 'service',
    wamid: 'wamid.in.1',
  });

  // Outbound service reply
  await UsageService.recordWhatsAppMessage(bizId, {
    direction: 'outbound',
    category: 'service',
    wamid: 'wamid.out.1',
  });

  // Outbound utility order confirmation
  await UsageService.recordWhatsAppMessage(bizId, {
    direction: 'outbound',
    category: 'utility',
    wamid: 'wamid.out.2',
  });

  const usage = await UsageService.getTenantUsage(bizId);
  assert.strictEqual(usage.whatsapp.inbound, 1);
  assert.strictEqual(usage.whatsapp.outbound, 2);
  assert.strictEqual(usage.whatsapp.total, 3);
  assert.strictEqual(usage.whatsapp.by_category.service, 2);
  assert.strictEqual(usage.whatsapp.by_category.utility, 1);
  assert(usage.whatsapp.billing_mode.includes('BYOC'), 'Should specify BYOC billing model');
});

test('TEST 4: Automation Workflow Execution Metering', async () => {
  const bizId = uuidv4();
  await query(
    `INSERT INTO businesses (id, name, industry_id, phone_number, email, plan_id, is_active)
     VALUES ($1, 'Auto Metric Store', 'retail', '+919111100004', 'auto_met@test.com', 'starter', true)`,
    [bizId]
  );
  await query(
    `INSERT INTO business_subscriptions (id, business_id, plan_id, status, billing_period_start, billing_period_end)
     VALUES (gen_random_uuid(), $1, 'starter', 'active', NOW(), NOW() + INTERVAL '30 days')`,
    [bizId]
  );

  await UsageService.recordAutomationExecution(bizId, { slug: 'incoming_whatsapp_message', success: true });
  await UsageService.recordAutomationExecution(bizId, { slug: 'human_handover', success: true });

  const usage = await UsageService.getTenantUsage(bizId);
  assert.strictEqual(usage.automation.executions, 2);
});

test('TEST 5: Tenant Usage Endpoint (GET /api/v1/subscriptions/usage)', async () => {
  const email = `usage_api_test_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Usage API Store',
      owner_name: 'Owner',
      email,
      password: 'password123',
      industry_id: 'restaurants',
      phone_number: '+919111100005',
    }),
  });
  const { access_token, business_id } = await regRes.json();

  // Record an operation
  await UsageService.recordAiOperation(business_id, {
    operationName: 'extract_intent_and_entities',
    promptTokens: 120,
    completionTokens: 40,
  });

  const usageRes = await fetch(`${baseUrl}/api/v1/subscriptions/usage`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  assert.strictEqual(usageRes.status, 200);
  const data = await usageRes.json();

  assert.strictEqual(data.subscription_plan, 'free');
  assert.strictEqual(data.ai_credits.used, 1.0);
  assert.strictEqual(data.ai_credits.limit, 50);
  assert.strictEqual(data.ai_credits.remaining, 49);
  assert.strictEqual(data.ai_credits.total_tokens, 160);
});

test('TEST 6: Admin COGS, Profitability & Margin Overview (GET /api/v1/subscriptions/admin/costs)', async () => {
  const email = `admin_costs_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Admin Cost Store',
      owner_name: 'Admin',
      email,
      password: 'password123',
      industry_id: 'restaurants',
      phone_number: '+919111100006',
    }),
  });
  const { access_token } = await regRes.json();

  const costsRes = await fetch(`${baseUrl}/api/v1/subscriptions/admin/costs`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  assert.strictEqual(costsRes.status, 200);
  const data = await costsRes.json();

  assert(data.revenue, 'Should return revenue details');
  assert(data.variable_expenses.gemini_api, 'Should return Gemini API expenses');
  assert.strictEqual(data.fixed_expenses.infrastructure_inr, 3600.0);
  assert(typeof data.profitability.gross_margin_percent === 'number');
});
