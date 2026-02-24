const express = require('express');
const dataService = require('../services/data.service');

const router = express.Router();

// Get all data
router.get('/api/data', (req, res) => {
  try {
    const data = dataService.getAllData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

// Get data by ID
router.get('/api/data/:id', (req, res) => {
  try {
    const data = dataService.getDataById(parseInt(req.params.id));
    if (data) {
      res.json(data);
    } else {
      res.status(404).json({ error: 'Data not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

// Filter data
router.post('/api/data/filter', (req, res) => {
  try {
    const criteria = req.body;
    const filtered = dataService.filterData(criteria);
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Failed to filter data' });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
