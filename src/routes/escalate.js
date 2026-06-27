const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../services/database');
const { sendEscalationAlert } = require('../services/email');

router.post('/', async (req, res) => {
  const { sessionId, userMessage, reason, customerName, customerEmail, customerPhone } = req.body;

  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const id = uuidv4();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO escalations (id, session_id, user_message, reason, status, created_at)
    VALUES (?, ?, ?, ?, 'open', ?)
  `).run(id, sessionId, userMessage || '', reason || 'Customer requested agent', now);

  try {
    await sendEscalationAlert({
      sessionId,
      userMessage: userMessage || 'No message provided',
      sentiment: 'neutral',
      reason: reason || 'Customer clicked "Talk to Agent"',
      customerName,
      customerEmail,
      customerPhone,
    });
  } catch (err) {
    console.error('Escalation email failed:', err.message);
  }

  res.json({
    success: true,
    ticketId: id,
    message: 'A team member has been notified and will be in touch shortly. You can also call us directly on 0404 094 064.',
  });
});

module.exports = router;
