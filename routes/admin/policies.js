// routes/admin/policies.js
// ------------------------------------------------------------------
// GET  /api/admin/policies           — list all policies
// GET  /api/admin/policies/:type     — get one by type
// PUT  /api/admin/policies/:type     — upsert policy content
// GET  /api/admin/policies/public/:type — public endpoint (no auth)
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

const VALID_TYPES = ['terms', 'shipping', 'refund', 'privacy', 'about'];

// ── GET public policy (no auth) ───────────────────────────────────
// Must be declared before router.use(adminAuth)
router.get('/public/:type', async (req, res) => {
  const { type } = req.params;
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('policies')
    .select('type, content, updated_at')
    .eq('type', type)
    .single();

  if (error || !data) return res.status(404).json({ message: 'Policy not found' });
  res.json({ success: true, policy: data });
});

// All routes below require admin auth
router.use(adminAuth);

// ── GET all policies ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('policies')
    .select('type, updated_at')
    .order('type');

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, policies: data });
});

// ── GET single by type ────────────────────────────────────────────
router.get('/:type', async (req, res) => {
  const { type } = req.params;
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('policies')
    .select('*')
    .eq('type', type)
    .single();

  if (error || !data) return res.status(404).json({ message: 'Policy not found' });
  res.json({ success: true, policy: data });
});

// ── PUT upsert ────────────────────────────────────────────────────
router.put('/:type', async (req, res) => {
  const { type } = req.params;
  const { content } = req.body;

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  if (!content) return res.status(400).json({ message: 'content is required' });

  // Upsert: update if exists, insert if not
  const { data: existing } = await supabase
    .from('policies')
    .select('id')
    .eq('type', type)
    .maybeSingle();

  let error;
  if (existing) {
    ({ error } = await supabase
      .from('policies')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('type', type));
  } else {
    ({ error } = await supabase
      .from('policies')
      .insert([{ type, content, updated_at: new Date().toISOString() }]));
  }

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: `Policy '${type}' saved` });
});

module.exports = router;