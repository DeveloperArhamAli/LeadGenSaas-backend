const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');

// Get all leads
router.get('/', async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }).limit(1000);
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single lead
router.get('/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }a
});

// Update lead
router.patch('/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;