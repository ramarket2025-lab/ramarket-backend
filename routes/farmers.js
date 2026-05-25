const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/farmers — list all farmers
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('farmers')
    .select('*');

  if (error) return res.status(400).json(error);
  res.json(data);
});

// GET /api/farmers/:id — single farmer
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('farmers')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: "Farmer not found" });
  res.json(data);
});

module.exports = router;