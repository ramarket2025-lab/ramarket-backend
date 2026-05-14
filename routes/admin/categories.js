// routes/admin/categories.js
// ------------------------------------------------------------------
// GET    /api/admin/categories          — list all
// POST   /api/admin/categories          — create
// PUT    /api/admin/categories/:id      — update
// DELETE /api/admin/categories/:id      — delete
// GET    /api/admin/categories/:id      — single
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

// ── GET all ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('id');

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, categories: data, total: data.length });
});

// ── GET single ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: 'Category not found' });
  res.json({ success: true, category: data });
});

// ── POST create ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, image_url } = req.body;

  if (!name) return res.status(400).json({ message: 'Category name is required' });

  const { data, error } = await supabase
    .from('categories')
    .insert([{ name, image_url }])
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json({ success: true, category: data });
});

// ── PUT update ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, image_url } = req.body;
  const updates = {};
  if (name      !== undefined) updates.name      = name;
  if (image_url !== undefined) updates.image_url = image_url;

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, category: data });
});

// ── DELETE ────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Category deleted' });
});

module.exports = router;