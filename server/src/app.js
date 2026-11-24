import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const MAX_PROGRESS_BYTES = 256 * 1024;

/**
 * Build the Express app around a pg-compatible `db` ({ query(text, params) }).
 * Kept separate from index.js so tests can inject an in-memory database.
 */
export function createApp({ db, jwtSecret, corsOrigin = '*', bcryptRounds = 12 }) {
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '300kb' }));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts — try again later.' } });

  const sign = (u) => jwt.sign({ sub: String(u.id), role: u.role }, jwtSecret, { expiresIn: '7d', algorithm: 'HS256' });
  const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  function auth(req, res, next) {
    const h = req.get('authorization') ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
      const p = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      req.user = { id: Number(p.sub), role: p.role };
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
  const requireRole = (role) => (req, res, next) => (req.user?.role === role ? next() : res.status(403).json({ error: 'Forbidden' }));

  app.get('/api/health', wrap(async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  }));

  app.post('/api/auth/register', authLimiter, wrap(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const name = String(req.body?.name ?? '').trim().slice(0, 80);
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Password must be 8–200 characters' });
    const exists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'An account with that email already exists' });
    const hash = await bcrypt.hash(password, bcryptRounds);
    const { rows } = await db.query('INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, role', [email, name, hash]);
    res.status(201).json({ token: sign(rows[0]), user: publicUser(rows[0]) });
  }));

  app.post('/api/auth/login', authLimiter, wrap(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const { rows } = await db.query('SELECT id, email, name, role, password_hash FROM users WHERE email = $1', [email]);
    // Compare against a dummy hash when the user is unknown so timing does not reveal which emails exist.
    const ok = await bcrypt.compare(password, rows[0]?.password_hash ?? '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5JmV8QeKCGjeVHT.4ZqA3hW9Gx3K1lO');
    if (!rows.length || !ok) return res.status(401).json({ error: 'Incorrect email or password' });
    res.json({ token: sign(rows[0]), user: publicUser(rows[0]) });
  }));

  // JWTs are stateless: logout is done client-side by discarding the token. This endpoint exists for symmetry.
  app.post('/api/auth/logout', auth, (_req, res) => res.status(204).end());

  app.get('/api/me', auth, wrap(async (req, res) => {
    const { rows } = await db.query('SELECT id, email, name, role FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(rows[0]) });
  }));

  app.get('/api/progress', auth, wrap(async (req, res) => {
    const { rows } = await db.query('SELECT data, updated_at FROM progress WHERE user_id = $1', [req.user.id]);
    res.json(rows.length ? { data: typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data, updatedAt: rows[0].updated_at } : { data: null });
  }));

  app.put('/api/progress', auth, wrap(async (req, res) => {
    const data = req.body?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'Body must be { data: object }' });
    const json = JSON.stringify(data);
    if (json.length > MAX_PROGRESS_BYTES) return res.status(413).json({ error: 'Progress data too large' });
    await db.query(
      `INSERT INTO progress (user_id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [req.user.id, json],
    );
    res.json({ ok: true });
  }));

  app.get('/api/admin/stats', auth, requireRole('admin'), wrap(async (_req, res) => {
    const u = await db.query('SELECT COUNT(*)::int AS n FROM users');
    const p = await db.query('SELECT COUNT(*)::int AS n FROM progress');
    res.json({ users: u.rows[0].n, usersWithProgress: p.rows[0].n });
  }));

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'Malformed JSON' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
