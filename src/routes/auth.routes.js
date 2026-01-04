const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const { pool } = require('../config/db');
const { env } = require('../config/env');
const { authRequired } = require('../middleware/auth');

const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().max(190),
  password: z.string().min(6).max(72),
});

const loginSchema = z.object({
  email: z.string().email().max(190),
  password: z.string().min(6).max(72),
});

router.post('/register', async (req, res, next) => {
  try {
    const { fullName, email, password } = registerSchema.parse(req.body);

    const [exists] = await pool.query('SELECT id FROM users WHERE email = :email LIMIT 1', { email });
    if (exists.length) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (:full_name, :email, :password_hash, :role)',
      { full_name: fullName, email, password_hash, role: 'user' }
    );

    const id = result.insertId;

    const token = jwt.sign({ id, email, role: 'user' }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

    res.status(201).json({
      user: { id, fullName, email, role: 'user' },
      token,
    });
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const [rows] = await pool.query(
      'SELECT id, full_name, email, password_hash, role FROM users WHERE email = :email LIMIT 1',
      { email }
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    res.json({
      user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.get('/me', authRequired, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, role, created_at FROM users WHERE id = :id LIMIT 1',
    { id: req.user.id }
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  const u = rows[0];
  res.json({ user: { id: u.id, fullName: u.full_name, email: u.email, role: u.role, createdAt: u.created_at } });
});

module.exports = router;
