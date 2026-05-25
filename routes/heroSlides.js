const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/hero-slides — list all active hero slides ordered by order_index
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('hero_slides')
    .select('*')
    .eq('is_active', true)
    .order('order_index');

  if (error) return res.status(400).json(error);
  res.json(data);
});

module.exports = router;