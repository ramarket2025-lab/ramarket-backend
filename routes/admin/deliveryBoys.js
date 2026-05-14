// routes/admin/deliveryBoys.js
// ------------------------------------------------------------------
// GET    /api/admin/delivery-boys                   — list (filterable)
// GET    /api/admin/delivery-boys/pending           — pending applications
// GET    /api/admin/delivery-boys/:id               — single + docs + assignments
// PATCH  /api/admin/delivery-boys/:id/status        — approve/reject/suspend
// GET    /api/admin/delivery-boys/:id/assignments   — assignment history
// GET    /api/admin/delivery-boys/:id/wallet        — wallet summary
// DELETE /api/admin/delivery-boys/:id               — remove boy
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

const VALID_STATUSES = ['Pending','Approved','Rejected','Suspended'];

// ── GET all (with optional status filter) ────────────────────────
router.get('/', async (req, res) => {
  const { status = '', page = 1, limit = 20, search = '' } = req.query;

  let query = supabase
    .from('delivery_boys')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);

  const from = (parseInt(page) - 1) * parseInt(limit);
  query = query.range(from, from + parseInt(limit) - 1);

  const { data, count, error } = await query;
  if (error) return res.status(400).json({ message: error.message });

  res.json({
    success:      true,
    deliveryBoys: data,
    total:        count,
    page:         parseInt(page),
    totalPages:   Math.ceil(count / parseInt(limit)),
  });
});

// ── GET pending applications ──────────────────────────────────────
router.get('/pending', async (req, res) => {
  const { data, count, error } = await supabase
    .from('delivery_boys')
    .select('*', { count: 'exact' })
    .eq('status', 'Pending')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, deliveryBoys: data, total: count });
});

// ── GET single + documents + assignment summary ───────────────────
router.get('/:id', async (req, res) => {
  const [
    { data: boy, error },
    { data: docs         },
    { data: assignments  },
    { data: wallet       },
  ] = await Promise.all([
    supabase.from('delivery_boys').select('*').eq('id', req.params.id).single(),
    supabase.from('delivery_boy_documents').select('*').eq('delivery_boy_id', req.params.id).maybeSingle(),
    supabase.from('delivery_assignments').select('*').eq('delivery_boy_id', req.params.id).order('assigned_at', { ascending: false }).limit(20),
    supabase.from('delivery_wallets').select('*').eq('delivery_boy_id', req.params.id).maybeSingle(),
  ]);

  if (error) return res.status(404).json({ message: 'Delivery boy not found' });

  const totalAssignments = (assignments || []).length;
  const delivered        = (assignments || []).filter(a => a.delivery_status === 'Delivered').length;

  res.json({
    success:     true,
    deliveryBoy: boy,
    documents:   docs || {},
    assignments: assignments || [],
    wallet:      wallet || null,
    stats: {
      totalAssignments,
      delivered,
      successRate: totalAssignments ? parseFloat(((delivered / totalAssignments) * 100).toFixed(1)) : 0,
    },
  });
});

// ── PATCH update status ───────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { status, reason } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const updates = { status };
  if (status === 'Rejected')  updates.rejection_reason  = reason || 'Rejected by admin';
  if (status === 'Suspended') updates.suspension_reason = reason || 'Suspended by admin';

  // Auto-create wallet on first approval
  if (status === 'Approved') {
    const { data: existingWallet } = await supabase
      .from('delivery_wallets')
      .select('id')
      .eq('delivery_boy_id', req.params.id)
      .maybeSingle();

    if (!existingWallet) {
      await supabase.from('delivery_wallets').insert([{
        delivery_boy_id: req.params.id,
        balance:         0,
        total_collected: 0,
        total_settled:   0,
      }]);
    }
  }

  const { data, error } = await supabase
    .from('delivery_boys')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, full_name, status')
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, deliveryBoy: data });
});

// ── GET assignment history ────────────────────────────────────────
router.get('/:id/assignments', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const from = (parseInt(page) - 1) * parseInt(limit);

  const { data, count, error } = await supabase
    .from('delivery_assignments')
    .select('*', { count: 'exact' })
    .eq('delivery_boy_id', req.params.id)
    .order('assigned_at', { ascending: false })
    .range(from, from + parseInt(limit) - 1);

  if (error) return res.status(400).json({ message: error.message });
  res.json({
    success:     true,
    assignments: data,
    total:       count,
    page:        parseInt(page),
    totalPages:  Math.ceil(count / parseInt(limit)),
  });
});

// ── GET wallet summary for a delivery boy ────────────────────────
router.get('/:id/wallet', async (req, res) => {
  const [
    { data: wallet },
    { data: pending },
    { data: txns    },
  ] = await Promise.all([
    supabase.from('delivery_wallets').select('*').eq('delivery_boy_id', req.params.id).maybeSingle(),
    supabase.from('delivery_settlements').select('*').eq('delivery_boy_id', req.params.id).eq('status', 'Pending'),
    supabase.from('delivery_wallet_transactions').select('*').eq('delivery_boy_id', req.params.id).order('created_at', { ascending: false }).limit(20),
  ]);

  res.json({
    success:             true,
    wallet:              wallet || null,
    pendingSettlements:  pending || [],
    recentTransactions:  txns   || [],
  });
});

// ── DELETE delivery boy ───────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('delivery_boys')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Delivery boy removed' });
});

module.exports = router;