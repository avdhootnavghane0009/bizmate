import test from 'node:test';
import assert from 'node:assert';
import app from '../app.js';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { SubscriptionService } from '../services/subscriptionService.js';
import { RazorpayService } from '../services/razorpayService.js';
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

test('TEST 1: Order creation requires authentication', async () => {
  const res = await fetch(`${baseUrl}/api/v1/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_id: 'starter' }),
  });

  assert.strictEqual(res.status, 401);
});

test('TEST 2: Order creation rejects free tier and invalid plans', async () => {
  // First register a test user
  const email = `pay_test_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Payment Test Cafe',
      owner_name: 'Pay Owner',
      email,
      password: 'password123',
      industry_id: 'restaurants',
      phone_number: '+919876500001',
    }),
  });
  assert.strictEqual(regRes.status, 201);
  const regData = await regRes.json();
  const token = regData.access_token;

  // Try ordering free plan
  const freeRes = await fetch(`${baseUrl}/api/v1/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan_id: 'free' }),
  });
  assert.strictEqual(freeRes.status, 400);

  // Try ordering invalid plan
  const invRes = await fetch(`${baseUrl}/api/v1/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan_id: 'nonexistent_tier' }),
  });
  assert.strictEqual(invRes.status, 400);
});

test('TEST 3: Successfully create Razorpay order for Growth plan', async () => {
  const email = `pay_order_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Growth Order Test',
      owner_name: 'Order Owner',
      email,
      password: 'password123',
      industry_id: 'salons_spas',
      phone_number: '+919876500002',
    }),
  });
  const regData = await regRes.json();
  const token = regData.access_token;

  const orderRes = await fetch(`${baseUrl}/api/v1/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan_id: 'growth', billing_cycle: 'monthly' }),
  });

  assert.strictEqual(orderRes.status, 200);
  const orderData = await orderRes.json();
  assert(orderData.order_id, 'Should return order_id');
  assert.strictEqual(orderData.amount, 149900, '1499 INR in paise');
  assert.strictEqual(orderData.currency, 'INR');
  assert(orderData.key_id, 'Should return key_id for checkout');
});

test('TEST 4: Reject payment verification with invalid signature', async () => {
  const email = `pay_tamper_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Tamper Test Store',
      owner_name: 'Tamper Owner',
      email,
      password: 'password123',
      industry_id: 'retail',
      phone_number: '+919876500003',
    }),
  });
  const regData = await regRes.json();
  const token = regData.access_token;

  const verifyRes = await fetch(`${baseUrl}/api/v1/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      razorpay_order_id: 'order_test_123',
      razorpay_payment_id: 'pay_test_456',
      razorpay_signature: 'TAMPERED_INVALID_SIGNATURE',
      plan_id: 'growth',
    }),
  });

  assert.strictEqual(verifyRes.status, 400);
});

test('TEST 5: Verified payment successfully activates subscription & records invoice', async () => {
  const email = `pay_success_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Verified Success Store',
      owner_name: 'Success Owner',
      email,
      password: 'password123',
      industry_id: 'retail',
      phone_number: '+919876500004',
    }),
  });
  const regData = await regRes.json();
  const token = regData.access_token;
  const businessId = regData.business_id;

  // Verify using mock signature accepted in mock mode
  const verifyRes = await fetch(`${baseUrl}/api/v1/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      razorpay_order_id: 'order_MOCK_12345',
      razorpay_payment_id: 'pay_MOCK_67890',
      razorpay_signature: 'MOCK_SIGNATURE_OK',
      plan_id: 'starter',
      billing_cycle: 'monthly',
    }),
  });

  assert.strictEqual(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.strictEqual(verifyData.success, true);
  assert.strictEqual(verifyData.subscription.plan_id, 'starter');
  assert.strictEqual(verifyData.subscription.status, 'active');

  // Check billing history
  const historyRes = await fetch(`${baseUrl}/api/v1/subscriptions/billing-history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(historyRes.status, 200);
  const historyData = await historyRes.json();
  assert(historyData.invoices.length >= 1, 'Should have at least 1 invoice recorded');
  assert.strictEqual(historyData.invoices[0].plan_id, 'starter');
  assert(historyData.payments.length >= 1, 'Should have at least 1 payment recorded');
  assert.strictEqual(historyData.payments[0].provider_payment_id, 'pay_MOCK_67890');
});

test('TEST 6: Webhook rejects request without signature', async () => {
  const webhookRes = await fetch(`${baseUrl}/api/v1/webhooks/razorpay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'payment.captured' }),
  });

  assert.strictEqual(webhookRes.status, 400);
});

test('TEST 7: Webhook rejects invalid HMAC signature', async () => {
  const payload = JSON.stringify({ event: 'payment.captured' });
  const webhookRes = await fetch(`${baseUrl}/api/v1/webhooks/razorpay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': 'invalid_hmac_hex_signature',
    },
    body: payload,
  });

  assert.strictEqual(webhookRes.status, 400);
});
