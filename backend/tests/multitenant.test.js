import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import { query } from '../config/database.js';

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('MULTI-TENANT TEST 1: New Restaurant Account Creation & Clean Zero-State', async () => {
  const timestamp = Date.now();
  const email = `restaurant_${timestamp}@testbiz.com`;

  // 1. Register new restaurant
  const regRes = await fetch(`${baseUrl}/api/v1/onboarding/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Bella Pasta Trattoria',
      industry_id: 'restaurants',
      email,
      password: 'testPassword123!',
      phone_number: '+919876500001',
      owner_name: 'Chef Marco',
      currency: 'INR',
    }),
  });

  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  assert.ok(regData.access_token);
  assert.equal(regData.business.name, 'Bella Pasta Trattoria');
  assert.equal(regData.business.industryId, 'restaurants');

  const token = regData.access_token;
  const bizId = regData.business.id;

  // 2. Query Dashboard metrics for this new restaurant
  const dashRes = await fetch(`${baseUrl}/api/v1/dashboard/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(dashRes.status, 200);
  const dashData = await dashRes.json();

  // Verifies: Starts with zero actual records, NO Spicy Bistro data, NO 128 clients, NO fabricated 148500
  assert.equal(dashData.kpis.total_leads, 0);
  assert.equal(dashData.kpis.total_orders, 0);
  assert.equal(dashData.kpis.revenue_this_month, 0);
  assert.equal(dashData.kpis.pending_payments, 0);
  assert.equal(dashData.kpis.ai_handled_rate, 0);
  assert.equal(dashData.industry, 'restaurants');
});

test('MULTI-TENANT TEST 2: New Salon Account Creation & Salon Configuration', async () => {
  const timestamp = Date.now();
  const email = `salon_${timestamp}@testbiz.com`;

  const regRes = await fetch(`${baseUrl}/api/v1/onboarding/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Glow Luxury Spa & Salon',
      industry_id: 'salons',
      email,
      password: 'testPassword123!',
      phone_number: '+919876500002',
      owner_name: 'Elena Gilbert',
    }),
  });

  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  const token = regData.access_token;

  assert.equal(regData.business.name, 'Glow Luxury Spa & Salon');
  assert.equal(regData.business.industryId, 'salons');

  const profileRes = await fetch(`${baseUrl}/api/v1/business/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(profileRes.status, 200);
  const profile = await profileRes.json();
  assert.equal(profile.industryId, 'salons');
});

test('MULTI-TENANT TEST 3 & 4: Strict Tenant Isolation & Real Database Transactions', async () => {
  const timestamp = Date.now();

  // Create Business A (Bakery)
  const regA = await fetch(`${baseUrl}/api/v1/onboarding/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: `Bakery A ${timestamp}`,
      industry_id: 'retail',
      email: `bakery_a_${timestamp}@test.com`,
      password: 'password123',
    }),
  });
  const dataA = await regA.json();
  const tokenA = dataA.access_token;
  const bizIdA = dataA.business.id;

  // Create Business B (Clinics)
  const regB = await fetch(`${baseUrl}/api/v1/onboarding/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: `Clinic B ${timestamp}`,
      industry_id: 'healthcare',
      email: `clinic_b_${timestamp}@test.com`,
      password: 'password123',
    }),
  });
  const dataB = await regB.json();
  const tokenB = dataB.access_token;
  const bizIdB = dataB.business.id;

  // 1. Business A adds Customer A
  const custA = await fetch(`${baseUrl}/api/v1/crm/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      name: 'Alice Bread Lover',
      phone: '+919811111111',
      stage: 'Qualified',
      value: 1200,
    }),
  });
  assert.equal(custA.status, 201);

  // 2. Business A records a real Order of ₹4,500
  const orderA = await fetch(`${baseUrl}/api/v1/operations/orders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      customer_name: 'Alice Bread Lover',
      amount: 4500.0,
      status: 'completed',
    }),
  });
  assert.equal(orderA.status, 201);

  // 3. Verify Business A's Dashboard reflects the transaction in real-time
  const dashA = await fetch(`${baseUrl}/api/v1/dashboard/metrics`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const kpisA = (await dashA.json()).kpis;
  assert.equal(kpisA.total_leads, 1);
  assert.equal(kpisA.total_orders, 1);
  assert.ok(kpisA.revenue_this_month >= 4500);

  // 4. Verify Business B has ZERO leads and ZERO revenue (Strict Isolation)
  const dashB = await fetch(`${baseUrl}/api/v1/dashboard/metrics`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const kpisB = (await dashB.json()).kpis;
  assert.equal(kpisB.total_leads, 0);
  assert.equal(kpisB.total_orders, 0);
  assert.equal(kpisB.revenue_this_month, 0);

  // 5. Verify Business B CRM returns empty array (No customer leak)
  const custsB = await fetch(`${baseUrl}/api/v1/crm/customers`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const listB = await custsB.json();
  assert.equal(listB.length, 0);
});

test('MULTI-TENANT TEST 5: Session Persistence Across Re-Login', async () => {
  const timestamp = Date.now();
  const email = `persisted_${timestamp}@testbiz.com`;
  const password = 'securePassword123!';

  // Register
  await fetch(`${baseUrl}/api/v1/onboarding/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Persistent Coffee Co',
      industry_id: 'restaurants',
      email,
      password,
    }),
  });

  // Re-login
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.access_token);
  assert.equal(loginData.business.name, 'Persistent Coffee Co');
  assert.equal(loginData.business.industryId, 'restaurants');
});

test('MULTI-TENANT TEST 6: Empty State Verification', async () => {
  const timestamp = Date.now();
  const regRes = await fetch(`${baseUrl}/api/v1/onboarding/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: `Empty Biz ${timestamp}`,
      industry_id: 'general',
      email: `empty_${timestamp}@test.com`,
      password: 'password123',
    }),
  });
  assert.equal(regRes.status, 201);
  const token = (await regRes.json()).access_token;

  const res = await fetch(`${baseUrl}/api/v1/dashboard/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.kpis.total_leads, 0);
  assert.equal(data.kpis.total_orders, 0);
  assert.equal(data.kpis.revenue_this_month, 0);
  assert.equal(data.kpis.ai_handled_rate, 0);
  assert.equal(data.kpis.has_conversations, false);
});

test('MULTI-TENANT TEST 7: Security - Rejection of Unauthorized Tenant Access', async () => {
  const timestamp = Date.now();
  // Register User A
  const regA = await fetch(`${baseUrl}/api/v1/onboarding/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: `Tenant A ${timestamp}`,
      email: `user_a_${timestamp}@test.com`,
      password: 'password123',
    }),
  });
  assert.equal(regA.status, 201);
  const tokenA = (await regA.json()).access_token;

  // Register User B
  const regB = await fetch(`${baseUrl}/api/v1/onboarding/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: `Tenant B ${timestamp}`,
      email: `user_b_${timestamp}@test.com`,
      password: 'password123',
    }),
  });
  assert.equal(regB.status, 201);
  const dataB = await regB.json();
  const bizIdB = dataB.business.id;

  // User A attempts to query Tenant B's data by passing Tenant B's ID in X-Business-Id
  const hackRes = await fetch(`${baseUrl}/api/v1/crm/customers`, {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Business-Id': bizIdB,
    },
  });

  // Must reject with 403 Forbidden
  assert.equal(hackRes.status, 403);
});

test('MULTI-TENANT TEST 8: Dynamic Industry Switching & Persistence', async () => {
  const timestamp = Date.now();
  const regRes = await fetch(`${baseUrl}/api/v1/onboarding/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: `Switchable Biz ${timestamp}`,
      industry_id: 'restaurants',
      email: `switch_${timestamp}@test.com`,
      password: 'password123',
    }),
  });
  assert.equal(regRes.status, 201);
  const token = (await regRes.json()).access_token;

  // Switch to salons
  const patchRes = await fetch(`${baseUrl}/api/v1/business/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ industry_id: 'salons' }),
  });
  assert.equal(patchRes.status, 200);
  const updated = await patchRes.json();
  assert.equal(updated.industryId, 'salons');

  // Verify dashboard now returns salons mode
  const dashRes = await fetch(`${baseUrl}/api/v1/dashboard/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(dashRes.status, 200);
  const dashData = await dashRes.json();
  assert.equal(dashData.industry, 'salons');
});
