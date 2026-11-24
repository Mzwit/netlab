import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

async function start() {
  const mem = newDb();
  mem.public.none(schema);
  const { Pool } = mem.adapters.createPg();
  const db = new Pool();
  const app = createApp({ db, jwtSecret: 'x'.repeat(40), bcryptRounds: 4 });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, token) => {
    const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  };
  return { server, call, db };
}

test('register, login, progress round-trip and role checks', async () => {
  const { server, call, db } = await start();
  try {
    assert.equal((await call('GET', '/api/health')).status, 200);
    assert.equal((await call('POST', '/api/auth/register', { email: 'bad', password: 'longenough' })).status, 400);
    assert.equal((await call('POST', '/api/auth/register', { email: 'a@b.co', password: 'short' })).status, 400);
    const reg = await call('POST', '/api/auth/register', { email: 'Student@Uni.ac.sz', password: 'correct horse', name: 'Thandi' });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.user.email, 'student@uni.ac.sz');
    assert.equal(reg.body.user.role, 'student');
    const { rows } = await db.query('SELECT password_hash FROM users');
    assert.match(rows[0].password_hash, /^\$2[aby]\$/);
    assert.equal((await call('POST', '/api/auth/register', { email: 'student@uni.ac.sz', password: 'correct horse' })).status, 409);
    assert.equal((await call('POST', '/api/auth/login', { email: 'student@uni.ac.sz', password: 'wrong pass' })).status, 401);
    assert.equal((await call('POST', '/api/auth/login', { email: 'nobody@x.io', password: 'whatever1' })).status, 401);
    const login = await call('POST', '/api/auth/login', { email: 'student@uni.ac.sz', password: 'correct horse' });
    assert.equal(login.status, 200);
    const t = login.body.token;
    assert.equal((await call('GET', '/api/progress')).status, 401);
    assert.equal((await call('GET', '/api/progress', null, 'garbage')).status, 401);
    assert.deepEqual((await call('GET', '/api/progress', null, t)).body, { data: null });
    const data = { completed: { 'lesson:b1': 1 }, bookmarks: ['protocol:tcp'] };
    assert.equal((await call('PUT', '/api/progress', { data }, t)).status, 200);
    assert.deepEqual((await call('GET', '/api/progress', null, t)).body.data, data);
    assert.equal((await call('PUT', '/api/progress', { data: [] }, t)).status, 400);
    assert.equal((await call('GET', '/api/me', null, t)).body.user.name, 'Thandi');
    assert.equal((await call('GET', '/api/admin/stats', null, t)).status, 403);
    await db.query("UPDATE users SET role = 'admin'");
    const admin = await call('POST', '/api/auth/login', { email: 'student@uni.ac.sz', password: 'correct horse' });
    const stats = await call('GET', '/api/admin/stats', null, admin.body.token);
    assert.equal(stats.status, 200);
    assert.equal(stats.body.users, 1);
    assert.equal((await call('POST', '/api/auth/logout', null, t)).status, 204);
  } finally {
    server.close();
  }
});
