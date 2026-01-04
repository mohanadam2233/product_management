const router = require('express').Router();
const { ping } = require('../config/db');

router.get('/', async (req, res) => {
  try {
    await ping();
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'db_error' });
  }
});

module.exports = router;
