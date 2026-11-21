import test from 'node:test';
import assert from 'node:assert';
import app from '../app.js';
import { query } from '../config/database.js';
import { SubscriptionService } from '../services/subscriptionService.js';
import { EntitlementService } from '../services/entitlementService.js';
import { WhatsAppPipeline } from '../services/whatsappPipeline.js';
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

test('TEST 1: Centralized Subscription Plans Catalog Endpoint', async () => {
  const res = await fetch(`${baseUrl}/api/v1/subscriptions/plans`);
  assert.strictEqual(res.status, 200);
  const plans = await res.json();

  assert(Array.isArray(plans), 'Plans should be an array');
  assert.strictEqual(plans.length, 5, 'Should have exactly 5 tiers');

  const free = plans.find((p) => p.id === 'free');
  assert.strictEqual(free.price, 0);
  assert.strictEqual(free.limits.ai_operations_monthly, 50);
  assert.strictEqual(free.limits.crm_contacts, 100);
  assert.strictEqual(free.limits.voice_processing, false);

  const starter = plans.find((p) => p.id === 'starter');
  assert.strictEqual(starter.price, 599);
  assert.strictEqual(starter.limits.ai_operations_monthly, 500);
  assert.strictEqual(starter.limits.crm_contacts, 1000);
  assert.strictEqual(starter.limits.voice_processing, true);

  const growth = plans.find((p) => p.id === 'growth');
  assert.strictEqual(growth.price, 1499);
  assert.strictEqual(growth.limits.ai_operations_monthly, 2500);

  const pro = plans.find((p) => p.id === 'pro');
  assert.strictEqual(pro.price, 3499);
  assert.strictEqual(pro.limits.ai_operations_monthly, 10000);

  const ent = plans.find((p) => p.id === 'enterprise');
  assert.strictEqual(ent.price, null);
});

test('TEST 2: Registration Defaults to Free Tier with Subscription Record', async () => {
  const email = `sub_test_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Free Trial Store',
      owner_name: 'Test Owner',
      email,
      password: 'password123',
      industry_id: 'restaurants',
      phone_number: '+919999900001',
    }),
  });

  assert.strictEqual(regRes.status, 201);
  const data = await regRes.json();
  assert.strictEqual(data.business.planId, 'free', 'New tenant must start on Free plan');

  // Verify in PostgreSQL business_subscriptions table
  const subDb = await query(
    'SELECT * FROM business_subscriptions WHERE business_id = $1',
    [data.business_id]
  );
  assert.strictEqual(subDb.rows.length, 1);
  assert.strictEqual(subDb.rows[0].plan_id, 'free');
  assert.strictEqual(subDb.rows[0].status, 'free');
});

test('TEST 3: Vulnerability Fix - PATCH /business/profile Cannot Change plan_id', async () => {
  // Register new tenant on free plan
  const email = `vuln_test_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Security Test Cafe',
      owner_name: 'Hacker Attempt',
      email,
      password: 'password123',
      industry_id: 'restaurants',
      phone_number: '+919999900002',
    }),
  });
  const { access_token, business_id } = await regRes.json();

  // Attempt exploit: sending plan_id: 'enterprise' via profile patch
  const patchRes = await fetch(`${baseUrl}/api/v1/business/profile`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Security Test Cafe Renamed',
      plan_id: 'enterprise', // Malicious attempt to upgrade for free
    }),
  });

  assert.strictEqual(patchRes.status, 200);

  // Verify business table still has plan_id = 'free'
  const bizCheck = await query('SELECT plan_id FROM businesses WHERE id = $1', [business_id]);
  assert.strictEqual(bizCheck.rows[0].plan_id, 'free', 'Exploit blocked: plan_id must NOT be altered via profile patch');
});

test('TEST 4: Direct Plan Upgrade Endpoint Rejects Unverified Requests', async () => {
  const email = `upgrade_test_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Direct Upgrade Cafe',
      owner_name: 'Owner',
      email,
      password: 'password123',
      industry_id: 'salons',
      phone_number: '+919999900003',
    }),
  });
  const { access_token } = await regRes.json();

  const upRes = await fetch(`${baseUrl}/api/v1/subscriptions/upgrade`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan_id: 'pro' }),
  });

  assert.strictEqual(upRes.status, 400);
  const upData = await upRes.json();
  assert.strictEqual(upData.error, 'VERIFIED_PAYMENT_REQUIRED');
});

test('TEST 5: Active Subscription Inspection Endpoint', async () => {
  const email = `sub_inspect_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Inspection Salon',
      owner_name: 'Salon Owner',
      email,
      password: 'password123',
      industry_id: 'salons',
      phone_number: '+919999900004',
    }),
  });
  const { access_token } = await regRes.json();

  const subRes = await fetch(`${baseUrl}/api/v1/subscriptions/current`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  assert.strictEqual(subRes.status, 200);
  const subData = await subRes.json();
  assert.strictEqual(subData.plan_id, 'free');
  assert.strictEqual(subData.status, 'free');
  assert.strictEqual(subData.plan.limits.ai_operations_monthly, 50);
});

test('TEST 6: Real-time Entitlements & Live Usage Metering', async () => {
  const email = `metering_test_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Metering Cafe',
      owner_name: 'Owner',
      email,
      password: 'password123',
      industry_id: 'restaurants',
      phone_number: '+919999900005',
    }),
  });
  const { access_token, business_id } = await regRes.json();

  // Add 2 customers
  await query(
    `INSERT INTO customers (id, business_id, name, phone) 
     VALUES (gen_random_uuid(), $1, 'Cust 1', '+919999911111'),
            (gen_random_uuid(), $1, 'Cust 2', '+919999911112')`,
    [business_id]
  );

  const entRes = await fetch(`${baseUrl}/api/v1/subscriptions/entitlements`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  assert.strictEqual(entRes.status, 200);
  const entData = await entRes.json();

  assert.strictEqual(entData.usage.crm_contacts.used, 2);
  assert.strictEqual(entData.usage.crm_contacts.limit, 100);
  assert.strictEqual(entData.usage.staff_accounts.used, 1); // 1 owner user
  assert.strictEqual(entData.usage.ai_operations.limit, 50);
});

test('TEST 7: CRM Contact Quota Enforcement Middleware', async () => {
  const email = `quota_test_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Quota Test Cafe',
      owner_name: 'Owner',
      email,
      password: 'password123',
      industry_id: 'restaurants',
      phone_number: '+919999900006',
    }),
  });
  const { access_token, business_id } = await regRes.json();

  // Artificially saturate contacts to 100
  await query(
    `INSERT INTO customers (id, business_id, name, phone)
     SELECT gen_random_uuid(), $1, 'Lead ' || i, '+9199000' || LPAD(i::text, 5, '0')
     FROM generate_series(1, 100) as i`,
    [business_id]
  );

  // Attempting to add 101st customer should be blocked by checkQuota('crm_contacts')
  const addRes = await fetch(`${baseUrl}/api/v1/crm/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Blocked 101st Customer',
      phone: '+919999999999',
    }),
  });

  assert.strictEqual(addRes.status, 402, 'Should return HTTP 402 Payment Required when quota exceeded');
  const errData = await addRes.json();
  assert.strictEqual(errData.error, 'QUOTA_EXCEEDED');
  assert.strictEqual(errData.resource, 'crm_contacts');
});

test('TEST 8: AI Quota Governance & Zero Data Loss Preservation', async () => {
  const bizId = uuidv4();
  await query(
    `INSERT INTO businesses (id, name, industry_id, phone_number, email, plan_id, is_active)
     VALUES ($1, 'Exhausted AI Cafe', 'restaurants', '+919888800001', 'ai_exhaust@test.com', 'free', true)`,
    [bizId]
  );
  await query(
    `INSERT INTO business_subscriptions (id, business_id, plan_id, status, billing_period_start, billing_period_end)
     VALUES (gen_random_uuid(), $1, 'free', 'free', NOW(), NOW() + INTERVAL '30 days')`,
    [bizId]
  );

  // Artificially simulate 50 AI messages (free limit is 50)
  const convId = uuidv4();
  const custId = uuidv4();
  await query(
    `INSERT INTO customers (id, business_id, name, phone) VALUES ($1, $2, 'Test Customer', '+919888800002')`,
    [custId, bizId]
  );
  await query(
    `INSERT INTO conversations (id, business_id, customer_id, channel) VALUES ($1, $2, $3, 'whatsapp')`,
    [convId, bizId, custId]
  );
  await query(
    `INSERT INTO messages (id, business_id, conversation_id, sender_type, content, created_at)
     SELECT gen_random_uuid(), $1, $2, 'ai', 'Auto reply ' || i, NOW()
     FROM generate_series(1, 50) as i`,
    [bizId, convId]
  );

  // Send an incoming message payload via WhatsAppPipeline
  const testWamid = `wamid.quota_test_${Date.now()}`;
  const incomingResult = await WhatsAppPipeline.processIncomingPayload({
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: '999999999' },
          contacts: [{ profile: { name: 'Pooja Customer' } }],
          messages: [{
            from: '919888800002',
            id: testWamid,
            type: 'text',
            text: { body: 'Kya table available hai?' },
            timestamp: String(Math.floor(Date.now() / 1000)),
          }],
        },
      }],
    }],
  });

  // Verify raw customer message was preserved in database
  const savedMsg = await query('SELECT * FROM messages WHERE whatsapp_message_id = $1', [testWamid]);
  assert.strictEqual(savedMsg.rows.length, 1, 'Incoming message must be saved with zero data loss');
  assert.strictEqual(savedMsg.rows[0].content, 'Kya table available hai?');
  assert.strictEqual(savedMsg.rows[0].sender_type, 'customer');
});

test('TEST 9: Voice Note Processing Quota Restriction on Free Plan', async () => {
  const bizId = uuidv4();
  await query(
    `INSERT INTO businesses (id, name, industry_id, phone_number, email, plan_id, is_active)
     VALUES ($1, 'Voice Restricted Cafe', 'restaurants', '+919777700001', 'voice_res@test.com', 'free', true)`,
    [bizId]
  );
  await query(
    `INSERT INTO business_subscriptions (id, business_id, plan_id, status)
     VALUES (gen_random_uuid(), $1, 'free', 'free')`,
    [bizId]
  );

  const voiceCheck = await EntitlementService.checkQuota(bizId, 'voice_processing');
  assert.strictEqual(voiceCheck.allowed, false, 'Free plan should restrict voice processing');
  assert.strictEqual(voiceCheck.required_plan, 'starter');
});

test('TEST 10: Verified Subscription Activation & SaaS Invoicing', async () => {
  const bizId = uuidv4();
  await query(
    `INSERT INTO businesses (id, name, industry_id, phone_number, email, plan_id, is_active)
     VALUES ($1, 'Paid Upgrade Salon', 'salons', '+919666600001', 'paid_up@test.com', 'free', true)`,
    [bizId]
  );
  await query(
    `INSERT INTO business_subscriptions (id, business_id, plan_id, status)
     VALUES (gen_random_uuid(), $1, 'free', 'free')`,
    [bizId]
  );

  // Activate Growth Plan via SubscriptionService
  const updatedSub = await SubscriptionService.activatePaidSubscription(bizId, 'growth', {
    paymentProvider: 'razorpay',
    providerPaymentId: 'pay_test_12345678',
    providerOrderId: 'order_test_87654321',
    amount: 1499.00,
    billingCycle: 'monthly',
  });

  assert.strictEqual(updatedSub.plan_id, 'growth');
  assert.strictEqual(updatedSub.status, 'active');
  assert.strictEqual(updatedSub.plan.limits.ai_operations_monthly, 2500);

  // Verify businesses table sync
  const bizDb = await query('SELECT plan_id FROM businesses WHERE id = $1', [bizId]);
  assert.strictEqual(bizDb.rows[0].plan_id, 'growth');

  // Verify SaaS invoice generated
  const invoices = await query('SELECT * FROM subscription_invoices WHERE business_id = $1', [bizId]);
  assert.strictEqual(invoices.rows.length, 1);
  assert.strictEqual(parseFloat(invoices.rows[0].amount), 1499.00);
});
