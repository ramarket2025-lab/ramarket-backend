const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET products
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*');

  if (error) return res.status(400).json(error);

  res.json(data);
});


router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(400).json(error);

  res.json(data);
});

module.exports = router;