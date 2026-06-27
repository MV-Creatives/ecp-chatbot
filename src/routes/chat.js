const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { chat, chatWithToolResult, detectSentiment, detectConversationType } = require('../services/claude');
const { createBooking } = require('../services/crm');
const { db } = require('../services/database');
const { sendEscalationAlert, sendBookingConfirmation, sendStaffBookingAlert } = require('../services/email');

const sessionHistory = new Map();
const sessionBookings = new Map(); // prevent duplicate bookings per session

async function loadHistoryFromDb(sid) {
  const rows = await db.prepare(`
    SELECT user_message, bot_response FROM chat_history
    WHERE session_id = ? ORDER BY timestamp ASC LIMIT 40
  `).all(sid);

  const messages = [];
  for (const row of rows) {
    messages.push({ role: 'user', content: row.user_message });
    messages.push({ role: 'assistant', content: row.bot_response });
  }
  return messages;
}

router.post('/', async (req, res) => {
  const { message, sessionId, userId } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const sid = sessionId || uuidv4();

  if (!sessionHistory.has(sid)) {
    const saved = await loadHistoryFromDb(sid);
    // Only restore recent history (last 24 hours) to avoid stale booking data
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = await db.prepare(
      `SELECT COUNT(*) as cnt FROM chat_history WHERE session_id = ? AND timestamp > ?`
    ).get(sid, cutoff);
    if (saved.length && recent?.cnt > 0) sessionHistory.set(sid, saved);
  }

  const history = sessionHistory.get(sid) || [];
  history.push({ role: 'user', content: message.trim() });

  try {
    const result = await chat(history);
    const sentiment = detectSentiment(message);
    const convType = detectConversationType(message);

    let botResponse;
    let bookingResult = null;

    const isToolUse = result.type === 'tool_use' && result.tool === 'create_booking';
    const existingBooking = sessionBookings.get(sid);
    // Allow re-booking only when customer is applying a discount code to an existing unpaid booking
    const isApplyingNewDiscount = isToolUse && result.input.discountCode && existingBooking && !existingBooking.discount_percent;

    if (isToolUse && existingBooking && !isApplyingNewDiscount) {
      // Booking already exists for this session — don't create a duplicate
      botResponse = `A booking is already confirmed for this session — ref ${existingBooking.booking_reference}. If you'd like to make a separate booking, please start a new chat.`;
      history.push({ role: 'assistant', content: result.responseContent });
      history.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: result.toolUseId, content: JSON.stringify({ success: false, error: 'Booking already exists for this session' }) }] });
      history.push({ role: 'assistant', content: botResponse });
      bookingResult = existingBooking;
    } else if (isToolUse) {
      if (isApplyingNewDiscount) {
        // Customer remembered their discount code after booking — replace with discounted version
        sessionBookings.delete(sid);
      }
      // Claude has all the info — execute the real booking
      history.push({ role: 'assistant', content: result.responseContent });

      let toolResult;
      try {
        const crmResult = await createBooking(result.input);
        toolResult = {
          success: true,
          booking_reference: crmResult.booking_reference,
          original_amount: crmResult.original_amount,
          discount_percent: crmResult.discount_percent,
          total_amount: crmResult.total_amount,
          payment_url: crmResult.payment_url,
        };
        bookingResult = toolResult;
      } catch (err) {
        console.error('Booking creation failed:', err.message);
        if (err.message.startsWith('INVALID_DISCOUNT_CODE:')) {
          const code = err.message.split(':')[1];
          botResponse = `That discount code "${code}" doesn't look right — double-check it and let me know the correct one, or I can go ahead and book without it.`;
          history.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: result.toolUseId, content: JSON.stringify({ success: false, error: 'Invalid discount code' }) }] });
          history.push({ role: 'assistant', content: botResponse });
          sessionHistory.set(sid, history);
          return res.json({ sessionId: sid, response: botResponse, sentiment: 'neutral', conversationType: 'booking', escalated: false, booking: null });
        }
        toolResult = { success: false, error: err.message };
      }

      // Save to local DB separately so a DB error never marks the booking as failed
      if (toolResult.success) {
        try {
          await db.prepare(`
            INSERT INTO bookings (id, session_id, crm_booking_id, parking_type, check_in, check_out,
              customer_name, customer_email, customer_phone, amount, status, payment_status, payment_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?, ?, ?)
          `).run(
            uuidv4(), sid, toolResult.booking_reference, result.input.parkingType,
            result.input.checkIn, result.input.checkOut,
            result.input.customerName, result.input.customerEmail, result.input.customerPhone,
            toolResult.total_amount, toolResult.payment_url || null, new Date().toISOString(), new Date().toISOString()
          );
        } catch (dbErr) {
          console.error('DB save failed (booking still created):', dbErr.message);
        }
      }

      if (toolResult.success) {
        const isFree = toolResult.total_amount === 0;
        const discountNote = toolResult.discount_percent > 0 ? ` (${toolResult.discount_percent}% discount applied)` : '';
        botResponse = isFree
          ? `You're all set! Booking confirmed — ref ${toolResult.booking_reference}${discountNote}. No payment required. A confirmation email is on its way!`
          : `You're all set! Booking confirmed — ref ${toolResult.booking_reference}. Total is $${toolResult.total_amount} AUD${discountNote}. Click the payment button below to lock it in and you'll get a confirmation email straight away.`;

        // Mark session as booked to prevent duplicates
        sessionBookings.set(sid, toolResult);

        // Emails handled by Base44 automations

      } else {
        const finalResult = await chatWithToolResult(history, result.toolUseId, toolResult);
        botResponse = finalResult.text;
      }

      // Add the tool result exchange to history
      history.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: result.toolUseId, content: JSON.stringify(toolResult) }] });
      history.push({ role: 'assistant', content: botResponse });

    } else {
      botResponse = result.text;
      history.push({ role: 'assistant', content: botResponse });
    }

    // Keep last 30 turns in memory
    if (history.length > 60) history.splice(0, 2);
    sessionHistory.set(sid, history);

    // Auto-escalate frustrated customers
    let escalated = false;
    if (sentiment === 'negative') {
      sendEscalationAlert({ sessionId: sid, userMessage: message, sentiment, reason: 'Auto-detected frustrated customer' })
        .catch(console.error);
      escalated = true;
    }

    // Store in DB
    await db.prepare(`
      INSERT INTO chat_history (id, session_id, user_id, user_message, bot_response, timestamp, conversation_type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), sid, userId || null, message, botResponse,
      new Date().toISOString(), convType,
      JSON.stringify({ sentiment, escalated, bookingCreated: !!bookingResult })
    );

    res.json({
      sessionId: sid,
      response: botResponse,
      sentiment,
      conversationType: convType,
      escalated,
      booking: bookingResult,
    });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process message. Please try again.' });
  }
});

router.get('/history/:sessionId', async (req, res) => {
  const rows = await db.prepare(`
    SELECT user_message, bot_response, timestamp, conversation_type
    FROM chat_history WHERE session_id = ? ORDER BY timestamp ASC
  `).all(req.params.sessionId);
  res.json({ history: rows });
});

module.exports = router;
