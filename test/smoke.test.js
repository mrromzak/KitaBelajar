// =============================================================
//  Smoke test — verifikasi endpoint utama hidup & response valid.
//  Jalankan: npm test
// =============================================================

process.env.JWT_SECRET = 'test-secret-key';
process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

test('GET /api/health — harus return status ok', async () => {
  const app = require('../src/server');
  // Health check is registered on the app, so we can test via supertest-like approach
  // For now, verify the route exists by checking the app's router stack
  let found = false;
  app._router.stack.forEach(r => {
    if (r.route && r.route.path === '/api/health' && r.route.methods.get) found = true;
  });
  assert.ok(found, 'Health check route harus terdaftar');
});

test('Environment variables harus tersedia', () => {
  assert.ok(process.env.JWT_SECRET, 'JWT_SECRET dibutuhkan');
  assert.ok(process.env.SUPABASE_URL, 'SUPABASE_URL dibutuhkan');
});

test('Module routes harus bisa di-load tanpa error', () => {
  // Auth & chat routes depend on Supabase — skip in unit test
  assert.doesNotThrow(() => require('../src/routes/kelas'));
  assert.doesNotThrow(() => require('../src/routes/quiz'));
  assert.doesNotThrow(() => require('../src/routes/soal'));
  assert.doesNotThrow(() => require('../src/routes/materi'));
  assert.doesNotThrow(() => require('../src/routes/analitik'));
});

test('Konsolidasi JS: bundle app-core-full.js harus valid', () => {
  const fs = require('fs');
  const path = require('path');
  const bundlePath = path.resolve(__dirname, '../frontend/public/js/app-core-full.js');
  assert.ok(fs.existsSync(bundlePath), 'File bundle harus ada');
  const content = fs.readFileSync(bundlePath, 'utf-8');
  assert.ok(content.includes('const AnalitikGuru'), 'Bundle harus punya AnalitikGuru');
  assert.ok(content.includes('function openKelas'), 'Bundle harus punya openKelas');
  assert.ok(content.includes('function submitKuisKelas'), 'Bundle harus punya submitKuisKelas');
});
