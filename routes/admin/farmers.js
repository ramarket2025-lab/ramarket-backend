// routes/admin/farmers.js
// ------------------------------------------------------------------
// GET    /api/admin/farmers        — list all
// GET    /api/admin/farmers/:id    — single (with linked products)
// POST   /api/admin/farmers        — create
// PUT    /api/admin/farmers/:id    — update
// DELETE /api/admin/farmers/:id    — delete
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

// ── GET all ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('farmers')
    .select('*')
    .order('id');

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, farmers: data, total: data.length });
});

// ── GET single + linked products ─────────────────────────────────
router.get('/:id', async (req, res) => {
  const [{ data: farmer, error }, { data: products }] = await Promise.all([
    supabase.from('farmers').select('*').eq('id', req.params.id).single(),
    supabase.from('products').select('id, name, price, stock, image').eq('farmer_id', req.params.id),
  ]);

  if (error) return res.status(404).json({ message: 'Farmer not found' });
  res.json({ success: true, farmer, linkedProducts: products || [] });
});

// ── POST create ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, product, description, image_url } = req.body;

  if (!name) return res.status(400).json({ message: 'Farmer name is required' });

  const { data, error } = await supabase
    .from('farmers')
    .insert([{ name, product, description, image_url }])
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json({ success: true, farmer: data });
});

// ── PUT update ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const allowed = ['name', 'product', 'description', 'image_url'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('farmers')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, farmer: data });
});

// ── DELETE ────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('farmers')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Farmer deleted' });
});

module.exports = router;