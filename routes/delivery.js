const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ─────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────

// POST /api/delivery/auth/login — delivery boy login by mobile
router.post('/auth/login', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ message: "mobile required" });

  const { data, error } = await supabase
    .from('delivery_boys')
    .select('*')
    .eq('mobile', mobile)
    .single();

  if (error || !data) return res.status(404).json({ message: "Delivery boy not registered" });
  if (data.status !== 'Approved') {
    return res.status(403).json({ message: `Account status: ${data.status}. Contact admin.` });
  }

  res.json({ success: true, delivery_boy: data });
});

// POST /api/delivery/auth/register — new delivery boy application
router.post('/auth/register', async (req, res) => {
  const {
    name, mobile, email, vehicle_type, vehicle_number,
    license_number, aadhar_number, address
  } = req.body;

  if (!name || !mobile) return res.status(400).json({ message: "name and mobile required" });

  const { data: existing } = await supabase
    .from('delivery_boys')
    .select('id')
    .eq('mobile', mobile)
    .maybeSingle();

  if (existing) return res.status(409).json({ message: "Mobile already registered" });

  const { data, error } = await supabase
    .from('delivery_boys')
    .insert([{
      name, mobile, email, vehicle_type, vehicle_number,
      license_number, aadhar_number, address,
      status: 'Pending',
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, delivery_boy: data });
});

// POST /api/delivery/auth/register/documents — upload document URLs after registration
router.post('/auth/register/documents', async (req, res) => {
  const { delivery_boy_id, aadhar_front, aadhar_back, license_front, profile_photo } = req.body;
  if (!delivery_boy_id) return res.status(400).json({ message: "delivery_boy_id required" });

  const { data, error } = await supabase
    .from('delivery_boy_documents')
    .upsert([{ delivery_boy_id, aadhar_front, aadhar_back, license_front, profile_photo }])
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, documents: data });
});

// ─────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────

// GET /api/delivery/profile/:id
router.get('/profile/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('delivery_boys')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: "Not found" });
  res.json(data);
});

// GET /api/delivery/profile/:id/documents
router.get('/profile/:id/documents', async (req, res) => {
  const { data, error } = await supabase
    .from('delivery_boy_documents')
    .select('*')
    .eq('delivery_boy_id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: "Documents not found" });
  res.json(data);
});

// ─────────────────────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────────────────────

// GET /api/delivery/assignments/:delivery_boy_id — get all assignments for a delivery boy
router.get('/assignments/:delivery_boy_id', async (req, res) => {
  const { status } = req.query;

  let query = supabase
    .from('delivery_assignments')
    .select('*, orders(*)')
    .eq('delivery_boy_id', req.params.delivery_boy_id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('delivery_status', status);

  const { data, error } = await query;
  if (error) return res.status(400).json(error);
  res.json(data);
});

// PATCH /api/delivery/assignments/:id/status — update delivery status
router.patch('/assignments/:id/status', async (req, res) => {
  const { status, order_id } = req.body;
  if (!status) return res.status(400).json({ message: "status required" });

  const now = new Date().toISOString();
  const validStatuses = ['Assigned', 'Picked Up', 'Out for Delivery', 'Delivered', 'Failed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('delivery_assignments')
    .update({ delivery_status: status, updated_at: now })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json(error);

  // Sync status back to orders table
  if (order_id) {
    const orderStatusMap = {
      'Picked Up':        'Shipped',
      'Out for Delivery': 'Out for Delivery',
      'Delivered':        'Delivered',
      'Failed':           'Failed'
    };
    const orderStatus = orderStatusMap[status];
    if (orderStatus) {
      await supabase.from('orders').update({ status: orderStatus, updated_at: now }).eq('id', order_id);
    }
  }

  res.json({ success: true, assignment: data });
});

// PATCH /api/delivery/assignments/:id/cod-collected — mark COD collected
router.patch('/assignments/:id/cod-collected', async (req, res) => {
  const { delivery_boy_id, cod_amount } = req.body;
  const now = new Date().toISOString();

  // Mark payment received on assignment
  await supabase
    .from('delivery_assignments')
    .update({ payment_received: true, payment_received_at: now })
    .eq('id', req.params.id);

  // Credit wallet
  const { data: wallet } = await supabase
    .from('delivery_wallets')
    .select('*')
    .eq('delivery_boy_id', delivery_boy_id)
    .single();

  if (wallet) {
    await supabase
      .from('delivery_wallets')
      .update({ cod_balance: (wallet.cod_balance || 0) + cod_amount, updated_at: now })
      .eq('delivery_boy_id', delivery_boy_id);

    await supabase
      .from('delivery_wallet_transactions')
      .insert([{
        delivery_boy_id,
        assignment_id: req.params.id,
        type:          'cod_credit',
        amount:        cod_amount,
        note:          'COD collected from customer',
        created_at:    now
      }]);
  }

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────────────────

// GET /api/delivery/wallet/:delivery_boy_id
router.get('/wallet/:delivery_boy_id', async (req, res) => {
  const { data, error } = await supabase
    .from('delivery_wallets')
    .select('*')
    .eq('delivery_boy_id', req.params.delivery_boy_id)
    .single();

  if (error) return res.status(404).json({ message: "Wallet not found" });
  res.json(data);
});

// GET /api/delivery/wallet/:delivery_boy_id/transactions
router.get('/wallet/:delivery_boy_id/transactions', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const from = (page - 1) * limit;

  const { data, error } = await supabase
    .from('delivery_wallet_transactions')
    .select('*')
    .eq('delivery_boy_id', req.params.delivery_boy_id)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return res.status(400).json(error);
  res.json(data);
});

// POST /api/delivery/wallet/:delivery_boy_id/settle — request settlement
router.post('/wallet/:delivery_boy_id/settle', async (req, res) => {
  const { amount, notes } = req.body;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('delivery_settlements')
    .insert([{
      delivery_boy_id: req.params.delivery_boy_id,
      amount,
      notes:  notes || null,
      status: 'Pending',
      created_at: now
    }])
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, settlement: data });
});

module.exports = router;