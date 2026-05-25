const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/addresses?phone=9876543210 — list user's addresses
router.get('/', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ message: "phone required" });

  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('phone', phone)
    .order('is_default', { ascending: false });

  if (error) return res.status(400).json(error);
  res.json(data);
});

// POST /api/addresses — add new address
router.post('/', async (req, res) => {
  const { phone, label, address, house_no, apartment, landmark, is_default } = req.body;
  if (!phone || !address) return res.status(400).json({ message: "phone and address required" });

  const { data, error } = await supabase
    .from('addresses')
    .insert([{ phone, label, address, house_no, apartment, landmark, is_default: is_default || false }])
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, address: data });
});

// PUT /api/addresses/:id — update address
router.put('/:id', async (req, res) => {
  const { label, address, house_no, apartment, landmark } = req.body;

  const { data, error } = await supabase
    .from('addresses')
    .update({ label, address, house_no, apartment, landmark })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, address: data });
});

// PATCH /api/addresses/:id/default — set as default (clears others for same phone)
router.patch('/:id/default', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "phone required" });

  // Clear default from all user addresses
  await supabase.from('addresses').update({ is_default: false }).eq('phone', phone);

  // Set new default
  const { data, error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, address: data });
});

// DELETE /api/addresses/:id — delete address
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json(error);
  res.json({ success: true });
});

module.exports = router;