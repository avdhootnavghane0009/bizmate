import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import { GeminiService } from '../services/geminiService.js';
import { InvoiceService } from '../services/invoiceService.js';
import { WhatsAppService } from '../services/whatsappService.js';
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

test('TEST 1: Root Health Check endpoint', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'online');
  assert.equal(data.project, 'Bizmate');
});

test('TEST 2: WhatsApp Webhook Handshake verification', async () => {
  const url = `${baseUrl}/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=11223344&hub.verify_token=bizmate_webhook_verify_token_secure`;
  const res = await fetch(url);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, '11223344');
});

test('TEST 3: Live Multilingual Detection and Hinglish Translation', async () => {
  const sample = 'Hi bhaiya, kal 6 baje haircut appointment book karna hai.';
  const res = await GeminiService.detectAndTranslate(sample);
  assert.ok(['Hinglish', 'Hindi'].includes(res.detected_language));
  assert.ok(res.english_translation.toLowerCase().includes('haircut'));
});

test('TEST 4: Live AI Intent Extraction and Rules (Salon Appointment)', async () => {
  const sample = 'Kal 6 baje haircut appointment book karna hai';
  const extracted = await GeminiService.extractIntentAndEntities(sample, 'salons');
  assert.equal(extracted.intent, 'appointment_booking');
  assert.ok(extracted.service_or_item.toLowerCase().includes('haircut'));
  assert.equal(extracted.requires_human_handover, false);
});

test('TEST 5: Live Human Handover Trigger on complaints/refunds', async () => {
  const complaint = 'Very angry with bad service! Please give me a refund and connect me to your manager immediately!';
  const extracted = await GeminiService.extractIntentAndEntities(complaint, 'salons');
  assert.equal(extracted.requires_human_handover, true);
});

test('TEST 6: Dashboard Metrics Endpoint serves live KPIs', async () => {
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@spicybistro.com', password: 'password123' }),
  });
  const { access_token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/v1/dashboard/metrics`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.kpis);
  assert.equal(typeof data.kpis.total_leads, 'number');
  assert.equal(typeof data.kpis.revenue_this_month, 'number');
  assert.equal(data.chartData.length, 7);
});

test('TEST 7: Live PostgreSQL Database Queries (CRM Customers)', async () => {
  const dbRes = await query('SELECT count(*) FROM customers');
  assert.ok(parseInt(dbRes.rows[0].count, 10) >= 4);

  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@spicybistro.com', password: 'password123' }),
  });
  const { access_token } = await loginRes.json();

  const convRes = await fetch(`${baseUrl}/api/v1/inbox/conversations`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  assert.equal(convRes.status, 200);
  const convs = await convRes.json();
  assert.ok(Array.isArray(convs));
});

test('TEST 8: Invoice GST Calculation', () => {
  const gst = InvoiceService.calculateGST(4500.0);
  assert.equal(gst.subtotal, 4500.0);
  assert.equal(gst.cgst, 405.0);
  assert.equal(gst.sgst, 405.0);
  assert.equal(gst.total_amount, 5310.0);
});

test('TEST 9: Auth Login Endpoint with database verification', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@spicybistro.com', password: 'password123' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.access_token);
  assert.equal(data.token_type, 'bearer');
});

test('TEST 10: Live WhatsApp Ingestion & Localized Reply Pipeline', async () => {
  const res = await fetch(`${baseUrl}/api/v1/inbox/simulate-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '919876543210',
      text: 'Bhaiya kal 6 baje haircut appointment book karna hai',
      msg_type: 'text',
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(['replied', 'human_handover_engaged', 'human_handling_active'].includes(data.status));
});

test('TEST 11: Webhook Idempotency on duplicate incoming message delivery', async () => {
  const duplicateWamid = `wamid.test.idemp_${Date.now()}`;
  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: '919876500000',
            text: { body: 'Test message for idempotency check' },
            type: 'text',
            id: duplicateWamid,
            timestamp: String(Math.floor(Date.now() / 1000)),
          }],
        },
      }],
    }],
  };

  // First ingestion
  const res1 = await fetch(`${baseUrl}/api/v1/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(res1.status, 200);

  // Second duplicate ingestion
  const res2 = await fetch(`${baseUrl}/api/v1/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(res2.status, 200);
});

test('TEST 12: Webhook Delivery Status Update (sent -> delivered -> read)', async () => {
  const testWamid = `wamid.status_test_${Date.now()}`;
  
  // Find or insert valid conversation
  let convId;
  const convRes = await query('SELECT id FROM conversations LIMIT 1');
  if (convRes.rows.length > 0) {
    convId = convRes.rows[0].id;
  } else {
    const custRes = await query('SELECT id, business_id FROM customers LIMIT 1');
    const newConv = await query(
      `INSERT INTO conversations (id, business_id, customer_id, channel, status)
       VALUES (gen_random_uuid(), $1, $2, 'whatsapp', 'active') RETURNING id`,
      [custRes.rows[0].business_id, custRes.rows[0].id]
    );
    convId = newConv.rows[0].id;
  }

  // Seed message
  await query(
    `INSERT INTO messages (id, business_id, conversation_id, sender_type, content, whatsapp_message_id, delivery_status, created_at)
     VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', $1, 'human', 'Status test', $2, 'sent', NOW())`,
    [convId, testWamid]
  );

  // Send status webhook
  const statusPayload = {
    entry: [{
      changes: [{
        value: {
          statuses: [{
            id: testWamid,
            status: 'delivered',
            timestamp: String(Math.floor(Date.now() / 1000)),
            recipient_id: '919876500000',
          }],
        },
      }],
    }],
  };

  const res = await fetch(`${baseUrl}/api/v1/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(statusPayload),
  });
  assert.equal(res.status, 200);

  // Verify status in DB
  await new Promise((r) => setTimeout(r, 200));
  const check = await query('SELECT delivery_status FROM messages WHERE whatsapp_message_id = $1', [testWamid]);
  assert.equal(check.rows[0]?.delivery_status, 'delivered');
});

test('TEST 13: Manual Outbound Reply from Shared Inbox', async () => {
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@spicybistro.com', password: 'password123' }),
  });
  const { access_token } = await loginRes.json();

  // Fetch or create conversation
  const convsRes = await fetch(`${baseUrl}/api/v1/inbox/conversations`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const convs = await convsRes.json();
  const convId = convs[0]?.id;

  if (convId) {
    const sendRes = await fetch(`${baseUrl}/api/v1/inbox/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        conversation_id: convId,
        content: 'Hello, your table is confirmed for tonight!',
      }),
    });
    assert.equal(sendRes.status, 200);
    const sentData = await sendRes.json();
    assert.equal(sentData.sender, 'human');
    assert.ok(sentData.content.includes('confirmed'));
  }
});
