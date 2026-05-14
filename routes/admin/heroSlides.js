// routes/admin/heroSlides.js
// ------------------------------------------------------------------
// GET    /api/admin/hero-slides          — list all slides
// GET    /api/admin/hero-slides/:id      — single slide
// POST   /api/admin/hero-slides          — create slide
// PUT    /api/admin/hero-slides/:id      — update slide
// DELETE /api/admin/hero-slides/:id      — delete slide
// PATCH  /api/admin/hero-slides/:id/toggle — toggle active/inactive
// PATCH  /api/admin/hero-slides/reorder    — update order_index for multiple
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

// ── GET all ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('hero_slides')
    .select('*')
    .order('order_index');

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, slides: data, total: data.length });
});

// ── GET single ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('hero_slides')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: 'Slide not found' });
  res.json({ success: true, slide: data });
});

// ── POST create ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { image_url, title, subtitle, cta_text, cta_link, order_index = 1, is_active = true } = req.body;

  if (!image_url) return res.status(400).json({ message: 'image_url is required' });

  const { data, error } = await supabase
    .from('hero_slides')
    .insert([{ image_url, title, subtitle, cta_text, cta_link, order_index, is_active }])
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json({ success: true, slide: data });
});

// ── PUT update ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const allowed = ['image_url','title','subtitle','cta_text','cta_link','order_index','is_active'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('hero_slides')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, slide: data });
});

// ── PATCH toggle active ───────────────────────────────────────────
router.patch('/:id/toggle', async (req, res) => {
  // Fetch current value, flip it
  const { data: current, error: fetchErr } = await supabase
    .from('hero_slides')
    .select('is_active')
    .eq('id', req.params.id)
    .single();

  if (fetchErr) return res.status(404).json({ message: 'Slide not found' });

  const { data, error } = await supabase
    .from('hero_slides')
    .update({ is_active: !current.is_active })
    .eq('id', req.params.id)
    .select('id, is_active')
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, slide: data });
});

// ── PATCH reorder — body: [{ id, order_index }] ──────────────────
router.patch('/reorder', async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items)) {
    return res.status(400).json({ message: 'items array required' });
  }

  const updates = items.map(({ id, order_index }) =>
    supabase.from('hero_slides').update({ order_index }).eq('id', id)
  );

  const results = await Promise.all(updates);
  const failed  = results.filter(r => r.error);
  if (failed.length) {
    return res.status(400).json({ message: 'Some reorders failed', errors: failed.map(f => f.error.message) });
  }

  res.json({ success: true, message: 'Slides reordered' });
});

// ── DELETE ────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('hero_slides')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Slide deleted' });
});

module.exports = router;