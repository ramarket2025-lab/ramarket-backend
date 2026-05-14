// routes/admin/wallets.js
// ------------------------------------------------------------------
// GET  /api/admin/wallets                          — all wallets
// GET  /api/admin/wallets/:delivery_boy_id          — single wallet
// GET  /api/admin/wallets/:delivery_boy_id/txns     — transaction history
// POST /api/admin/wallets/settlements/:id/confirm   — confirm cash received
// GET  /api/admin/wallets/settlements               — list all pending settlements
// POST /api/admin/wallets/settlements/bulk-confirm  — bulk confirm
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

// ── GET all wallets with delivery boy info ────────────────────────
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('delivery_wallets')
    .select('*, delivery_boys(full_name, phone, status)')
    .order('balance', { ascending: false });

  if (error) return res.status(400).json({ message: error.message });

  // Attach pending settlement count to each wallet
  const ids = (data || []).map(w => w.delivery_boy_id);
  const { data: pending } = await supabase
    .from('delivery_settlements')
    .select('delivery_boy_id, id, amount')
    .in('delivery_boy_id', ids)
    .eq('status', 'Pending');

  const pendingMap = {};
  (pending || []).forEach(s => {
    if (!pendingMap[s.delivery_boy_id]) pendingMap[s.delivery_boy_id] = [];
    pendingMap[s.delivery_boy_id].push(s);
  });

  const enriched = (data || []).map(w => ({
    ...w,
    pendingSettlements: pendingMap[w.delivery_boy_id] || [],
    pendingTotal: (pendingMap[w.delivery_boy_id] || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0),
  }));

  res.json({ success: true, wallets: enriched, total: enriched.length });
});

// ── GET single wallet ─────────────────────────────────────────────
router.get('/:delivery_boy_id', async (req, res) => {
  const { data: wallet, error } = await supabase
    .from('delivery_wallets')
    .select('*, delivery_boys(full_name, phone)')
    .eq('delivery_boy_id', req.params.delivery_boy_id)
    .maybeSingle();

  if (error || !wallet) return res.status(404).json({ message: 'Wallet not found' });

  const { data: pending } = await supabase
    .from('delivery_settlements')
    .select('*')
    .eq('delivery_boy_id', req.params.delivery_boy_id)
    .eq('status', 'Pending');

  res.json({ success: true, wallet, pendingSettlements: pending || [] });
});

// ── GET transaction history ───────────────────────────────────────
router.get('/:delivery_boy_id/txns', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const from = (parseInt(page) - 1) * parseInt(limit);

  const { data, count, error } = await supabase
    .from('delivery_wallet_transactions')
    .select('*', { count: 'exact' })
    .eq('delivery_boy_id', req.params.delivery_boy_id)
    .order('created_at', { ascending: false })
    .range(from, from + parseInt(limit) - 1);

  if (error) return res.status(400).json({ message: error.message });
  res.json({
    success:      true,
    transactions: data,
    total:        count,
    page:         parseInt(page),
    totalPages:   Math.ceil(count / parseInt(limit)),
  });
});

// ── GET all pending settlements ───────────────────────────────────
router.get('/settlements', async (req, res) => {
  const { data, error } = await supabase
    .from('delivery_settlements')
    .select('*, delivery_boys(full_name, phone)')
    .eq('status', 'Pending')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, settlements: data, total: (data || []).length });
});

// ── POST confirm single settlement ────────────────────────────────
router.post('/settlements/:id/confirm', async (req, res) => {
  const { notes = '' } = req.body;
  const settlementId   = req.params.id;
  const now            = new Date().toISOString();

  // 1. Fetch settlement
  const { data: settlement, error: fetchErr } = await supabase
    .from('delivery_settlements')
    .select('*')
    .eq('id', settlementId)
    .single();

  if (fetchErr || !settlement) {
    return res.status(404).json({ message: 'Settlement not found' });
  }
  if (settlement.status === 'Confirmed') {
    return res.status(400).json({ message: 'Settlement already confirmed' });
  }

  const amount  = parseFloat(settlement.amount || 0);
  const boyId   = settlement.delivery_boy_id;

  // 2. Mark confirmed
  const { error: confirmErr } = await supabase
    .from('delivery_settlements')
    .update({ status: 'Confirmed', confirmed_at: now, confirmed_by: 'admin', notes: notes || null })
    .eq('id', settlementId);

  if (confirmErr) return res.status(400).json({ message: confirmErr.message });

  // 3. Deduct from wallet + log transaction
  const { data: wallet } = await supabase
    .from('delivery_wallets')
    .select('id, balance, total_settled')
    .eq('delivery_boy_id', boyId)
    .maybeSingle();

  if (wallet) {
    const newBalance = Math.max(0, parseFloat(wallet.balance) - amount);

    await supabase.from('delivery_wallets').update({
      balance:       newBalance,
      total_settled: parseFloat(wallet.total_settled || 0) + amount,
      updated_at:    now,
    }).eq('delivery_boy_id', boyId);

    await supabase.from('delivery_wallet_transactions').insert([{
      delivery_boy_id:  boyId,
      wallet_id:        wallet.id,
      transaction_type: 'debit',
      amount,
      reason:           notes || 'Cash settlement confirmed by admin',
      settlement_id:    settlementId,
      balance_after:    newBalance,
    }]);
  }

  res.json({ success: true, message: 'Settlement confirmed, wallet updated' });
});

// ── POST bulk confirm settlements ─────────────────────────────────
router.post('/settlements/bulk-confirm', async (req, res) => {
  const { ids, notes = '' } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ message: 'ids array is required' });
  }

  const results = { confirmed: [], failed: [] };

  for (const id of ids) {
    try {
      const { data: s } = await supabase
        .from('delivery_settlements')
        .select('*').eq('id', id).single();

      if (!s || s.status === 'Confirmed') { results.failed.push({ id, reason: 'Not found or already confirmed' }); continue; }

      const now    = new Date().toISOString();
      const amount = parseFloat(s.amount || 0);
      const boyId  = s.delivery_boy_id;

      await supabase.from('delivery_settlements')
        .update({ status: 'Confirmed', confirmed_at: now, confirmed_by: 'admin', notes: notes || null })
        .eq('id', id);

      const { data: wallet } = await supabase
        .from('delivery_wallets').select('id, balance, total_settled').eq('delivery_boy_id', boyId).maybeSingle();

      if (wallet) {
        const newBalance = Math.max(0, parseFloat(wallet.balance) - amount);
        await supabase.from('delivery_wallets')
          .update({ balance: newBalance, total_settled: parseFloat(wallet.total_settled || 0) + amount, updated_at: now })
          .eq('delivery_boy_id', boyId);
        await supabase.from('delivery_wallet_transactions').insert([{
          delivery_boy_id: boyId, wallet_id: wallet.id,
          transaction_type: 'debit', amount, reason: notes || 'Bulk settlement confirmed',
          settlement_id: id, balance_after: newBalance,
        }]);
      }

      results.confirmed.push(id);
    } catch (e) {
      results.failed.push({ id, reason: e.message });
    }
  }

  res.json({ success: true, results });
});

module.exports = router;