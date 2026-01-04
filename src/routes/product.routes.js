const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../config/db');
const { authRequired } = require('../middleware/auth');

const createSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(100),
  description: z.string().max(3000).optional().default(''),
  price: z.coerce.number().nonnegative(),
  stock: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().optional().default(true),
});

const updateSchema = createSchema.partial();

function canAccess(reqUser, rowUserId) {
  return reqUser.role === 'admin' || Number(reqUser.id) === Number(rowUserId);
}

// List (own products)
router.get('/', authRequired, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const [rows] = await pool.query(
      isAdmin
        ? 'SELECT * FROM products ORDER BY updated_at DESC'
        : 'SELECT * FROM products WHERE user_id = :user_id ORDER BY updated_at DESC',
      isAdmin ? {} : { user_id: req.user.id }
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

// Get one
router.get('/:id', authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM products WHERE id = :id LIMIT 1', { id });
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    const p = rows[0];
    if (!canAccess(req.user, p.user_id)) return res.status(403).json({ error: 'Forbidden' });
    res.json({ item: p });
  } catch (err) { next(err); }
});

// Create
router.post('/', authRequired, async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    // enforce unique SKU per user (simple)
    const [exists] = await pool.query(
      'SELECT id FROM products WHERE user_id = :user_id AND sku = :sku LIMIT 1',
      { user_id: req.user.id, sku: data.sku }
    );
    if (exists.length) return res.status(409).json({ error: 'SKU already exists' });

    const [result] = await pool.query(
      `INSERT INTO products (user_id, name, sku, description, price, stock, is_active)
       VALUES (:user_id, :name, :sku, :description, :price, :stock, :is_active)`,
      {
        user_id: req.user.id,
        name: data.name,
        sku: data.sku,
        description: data.description ?? '',
        price: data.price,
        stock: data.stock ?? 0,
        is_active: data.isActive ? 1 : 0,
      }
    );

    const [rows] = await pool.query('SELECT * FROM products WHERE id = :id', { id: result.insertId });
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// Update
router.put('/:id', authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = updateSchema.parse(req.body);

    const [rows] = await pool.query('SELECT * FROM products WHERE id = :id LIMIT 1', { id });
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    const p = rows[0];
    if (!canAccess(req.user, p.user_id)) return res.status(403).json({ error: 'Forbidden' });

    const patch = {
      name: data.name ?? p.name,
      sku: data.sku ?? p.sku,
      description: data.description ?? p.description,
      price: (data.price === undefined) ? p.price : data.price,
      stock: (data.stock === undefined) ? p.stock : data.stock,
      is_active: (data.isActive === undefined) ? p.is_active : (data.isActive ? 1 : 0),
    };

    // if sku changed, re-check uniqueness per user
    if (patch.sku !== p.sku) {
      const [exists] = await pool.query(
        'SELECT id FROM products WHERE user_id = :user_id AND sku = :sku AND id <> :id LIMIT 1',
        { user_id: p.user_id, sku: patch.sku, id }
      );
      if (exists.length) return res.status(409).json({ error: 'SKU already exists' });
    }

    await pool.query(
      `UPDATE products
       SET name=:name, sku=:sku, description=:description, price=:price, stock=:stock, is_active=:is_active
       WHERE id=:id`,
      { ...patch, id }
    );

    const [updated] = await pool.query('SELECT * FROM products WHERE id = :id', { id });
    res.json({ item: updated[0] });
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// Delete
router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM products WHERE id = :id LIMIT 1', { id });
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    const p = rows[0];
    if (!canAccess(req.user, p.user_id)) return res.status(403).json({ error: 'Forbidden' });

    await pool.query('DELETE FROM products WHERE id = :id', { id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
