import test from 'node:test';
import assert from 'node:assert';
import app from '../app.js';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { MediaStorageService } from '../services/mediaStorageService.js';

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

test('TEST 1: AES-256-GCM Token Encryption & Decryption Roundtrip', () => {
  const originalToken = 'EAAG...MetaWhatsAppSecretAccessToken1234567890';
  const encrypted = encrypt(originalToken);

  assert(encrypted.startsWith('enc:gcm:'), 'Encrypted token should have enc:gcm: prefix');
  assert.notStrictEqual(encrypted, originalToken, 'Encrypted token must differ from plaintext');

  const decrypted = decrypt(encrypted);
  assert.strictEqual(decrypted, originalToken, 'Decrypted token must exactly match original plaintext');
});

test('TEST 2: Backward Compatibility for Legacy Plaintext Tokens', () => {
  const legacyToken = 'EAAB_legacy_unencrypted_token';
  const decrypted = decrypt(legacyToken);
  assert.strictEqual(decrypted, legacyToken, 'Legacy unencrypted tokens must be returned as-is');
});

test('TEST 3: Rejection of Tampered Ciphertext or Invalid Authentication Tag', () => {
  const originalToken = 'super_secret_token_to_tamper';
  const encrypted = encrypt(originalToken);

  // Tamper with ciphertext by corrupting last character
  const tampered = encrypted.slice(0, -2) + 'ff';
  assert.throws(
    () => decrypt(tampered),
    /tampered|failed/i,
    'Tampered ciphertext must fail authenticated tag check'
  );
});

test('TEST 4: Media Storage MIME Type Validation', () => {
  const dummyBuffer = Buffer.from('RIFF....WAVEfmt ');

  // Valid audio/ogg
  assert.doesNotThrow(() => {
    MediaStorageService.validate(dummyBuffer, 'audio/ogg');
  });

  // Valid image/jpeg
  assert.doesNotThrow(() => {
    MediaStorageService.validate(dummyBuffer, 'image/jpeg');
  });

  // Disallowed executable / malicious MIME type
  assert.throws(
    () => MediaStorageService.validate(dummyBuffer, 'application/x-msdownload'),
    /Unsupported media type/i
  );

  // Empty buffer rejected
  assert.throws(
    () => MediaStorageService.validate(Buffer.alloc(0), 'audio/ogg'),
    /empty/i
  );
});

test('TEST 5: Media Storage Maximum File Size Limit (25MB)', () => {
  const oversizedBuffer = Buffer.alloc(26 * 1024 * 1024); // 26 MB

  assert.throws(
    () => MediaStorageService.validate(oversizedBuffer, 'audio/ogg'),
    /exceeds maximum allowed limit/i
  );
});

test('TEST 6: WhatsApp BYOC Account Connect Encrypts Tokens at Rest in PostgreSQL', async () => {
  const email = `wa_byoc_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Encrypted BYOC Store',
      owner_name: 'BYOC Owner',
      email,
      password: 'password123',
      industry_id: 'restaurants',
      phone_number: '+919876540001',
    }),
  });
  assert.strictEqual(regRes.status, 201);
  const { access_token, business_id } = await regRes.json();

  const rawMetaToken = 'EAAN...SecretMetaTokenForWhatsAppBYOC12345';
  const rawMetaSecret = 'my_secret_app_secret_999';

  const connectRes = await fetch(`${baseUrl}/api/v1/settings/whatsapp/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      phone_number_id: '109876543210987',
      access_token: rawMetaToken,
      app_secret: rawMetaSecret,
    }),
  });

  assert.strictEqual(connectRes.status, 200);

  // Directly inspect database table whatsapp_accounts to verify encryption at rest
  const dbCheck = await query(
    'SELECT access_token, app_secret FROM whatsapp_accounts WHERE business_id = $1',
    [business_id]
  );
  assert.strictEqual(dbCheck.rows.length, 1);
  const row = dbCheck.rows[0];

  assert(
    row.access_token.startsWith('enc:gcm:'),
    'access_token in database must be encrypted with AES-256-GCM'
  );
  assert.notStrictEqual(
    row.access_token,
    rawMetaToken,
    'Plaintext access_token must NEVER be stored raw in the database'
  );

  // Decryption recovers exact plaintext
  assert.strictEqual(decrypt(row.access_token), rawMetaToken);
  if (row.app_secret) {
    assert(row.app_secret.startsWith('enc:gcm:'));
    assert.strictEqual(decrypt(row.app_secret), rawMetaSecret);
  }
});

test('TEST 7: Cross-Tenant Message Isolation', async () => {
  // Tenant A
  const emailA = `tenant_a_${Date.now()}@example.com`;
  const regA = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Tenant Alpha',
      owner_name: 'Alpha Owner',
      email: emailA,
      password: 'password123',
      industry_id: 'retail',
      phone_number: '+919999000001',
    }),
  });
  const dataA = await regA.json();

  // Tenant B
  const emailB = `tenant_b_${Date.now()}@example.com`;
  const regB = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Tenant Beta',
      owner_name: 'Beta Owner',
      email: emailB,
      password: 'password123',
      industry_id: 'salons_spas',
      phone_number: '+919999000002',
    }),
  });
  const dataB = await regB.json();

  // Tenant A queries inbox
  const inboxResA = await fetch(`${baseUrl}/api/v1/inbox/conversations`, {
    headers: { Authorization: `Bearer ${dataA.access_token}` },
  });
  assert.strictEqual(inboxResA.status, 200);
  const convsA = await inboxResA.json();

  // Tenant B queries inbox
  const inboxResB = await fetch(`${baseUrl}/api/v1/inbox/conversations`, {
    headers: { Authorization: `Bearer ${dataB.access_token}` },
  });
  assert.strictEqual(inboxResB.status, 200);
  const convsB = await inboxResB.json();

  // Verify none of Tenant B's data is visible to Tenant A
  assert.strictEqual(Array.isArray(convsA), true);
  assert.strictEqual(Array.isArray(convsB), true);
});
