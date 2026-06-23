const express = require('express');
const router = express.Router();
const { getCruiseSchedule } = require('../services/crm');

let cache = { data: null, fetchedAt: null };
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && cache.fetchedAt && (now - cache.fetchedAt) < CACHE_TTL_MS) {
      return res.json({ ...cache.data, cached: true });
    }

    const schedule = await getCruiseSchedule();
    cache = { data: schedule, fetchedAt: now };
    res.json(schedule);
  } catch (err) {
    console.error('Cruise schedule error:', err);
    if (cache.data) return res.json({ ...cache.data, cached: true });
    res.status(500).json({ error: 'Failed to fetch cruise schedule' });
  }
});

module.exports = router;
