const express = require('express');
const router = express.Router();
const { verifyPayment, getStripePublishableKey, debugDiscountEndpoints } = require('../services/crm');
const { sendBookingConfirmation } = require('../services/email');
const { db } = require('../services/database');

// Called after user completes Stripe payment — accepts either a Stripe session ID directly,
// or a booking reference (we look up the payment_url and extract the session ID from it).
router.post('/verify', async (req, res) => {
  let { sessionId: stripeSessionId, bookingId, bookingReference } = req.body;

  if (!stripeSessionId && bookingReference) {
    const row = await db.prepare(
      `SELECT id, payment_url FROM bookings WHERE crm_booking_id = ? LIMIT 1`
    ).get(bookingReference);

    if (!row || !row.payment_url) {
      return res.status(404).json({ error: 'Booking not found or payment URL missing' });
    }

    bookingId = bookingId || row.id;
    const match = row.payment_url.match(/\/(cs_(?:live|test)_[^#?/]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Could not extract Stripe session from payment URL' });
    }
    stripeSessionId = match[1];
  }

  if (!stripeSessionId) {
    return res.status(400).json({ error: 'stripeSessionId or bookingReference is required' });
  }

  try {
    const result = await verifyPayment(stripeSessionId);
    const { booking, payment_status } = result;

    if (payment_status !== 'paid') {
      return res.status(402).json({ error: `Payment not completed (status: ${payment_status})` });
    }

    // Update local record if we have a bookingId
    if (bookingId) {
      await db.prepare(`
        UPDATE bookings SET payment_status = 'paid', status = 'confirmed', updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), bookingId);
    }

    // Send confirmation email
    if (booking?.customer_email) {
      sendBookingConfirmation({
        customerEmail: booking.customer_email,
        customerName: booking.customer_name,
        bookingId: booking.booking_reference,
        checkIn: booking.entry_date,
        checkOut: booking.exit_date,
        parkingType: booking.parking_type,
        amount: booking.total_amount,
      }).catch(console.error);
    }

    res.json({
      success: true,
      bookingReference: booking?.booking_reference,
      status: booking?.booking_status,
      paymentStatus: payment_status,
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Lightweight poll endpoint — widget checks this every 20s after a booking is created.
// Checks local DB first; only calls Base44 if still unpaid.
router.get('/status/:bookingReference', async (req, res) => {
  const { bookingReference } = req.params;
  const row = await db.prepare(
    'SELECT id, payment_status, payment_url FROM bookings WHERE crm_booking_id = ? LIMIT 1'
  ).get(bookingReference);

  if (!row) return res.json({ paid: false });
  if (row.payment_status === 'paid') return res.json({ paid: true });

  if (row.payment_url) {
    try {
      const match = row.payment_url.match(/\/(cs_(?:live|test)_[^#?/]+)/);
      if (match) {
        const result = await verifyPayment(match[1]);
        if (result.payment_status === 'paid') {
          await db.prepare(
            'UPDATE bookings SET payment_status = "paid", status = "confirmed", updated_at = ? WHERE id = ?'
          ).run(new Date().toISOString(), row.id);
          if (result.booking?.customer_email) {
            sendBookingConfirmation({
              customerEmail: result.booking.customer_email,
              customerName: result.booking.customer_name,
              bookingId: result.booking.booking_reference,
              checkIn: result.booking.entry_date,
              checkOut: result.booking.exit_date,
              parkingType: result.booking.parking_type,
              amount: result.booking.total_amount,
            }).catch(console.error);
          }
          return res.json({ paid: true });
        }
      }
    } catch(e) { /* payment likely not completed yet */ }
  }

  res.json({ paid: false });
});

// One-time admin sync — finds all unpaid bookings with a payment_url and tries to verify each.
// Protected by the widget API key. Hit once, then it's safe to leave (idempotent).
router.get('/sync-unpaid', async (req, res) => {
  const rows = await db.prepare(
    `SELECT id, crm_booking_id, payment_url, payment_status
     FROM bookings
     WHERE payment_status != 'paid' AND payment_url IS NOT NULL`
  ).all();

  const results = [];

  for (const row of rows) {
    const entry = { bookingReference: row.crm_booking_id, previousStatus: row.payment_status, outcome: null };
    try {
      const match = (row.payment_url || '').match(/\/(cs_(?:live|test)_[^#?/]+)/);
      if (!match) { entry.outcome = 'no_session_id'; results.push(entry); continue; }

      const result = await verifyPayment(match[1]);
      if (result.payment_status === 'paid') {
        db.prepare(
          `UPDATE bookings SET payment_status = 'paid', status = 'confirmed', updated_at = ? WHERE id = ?`
        ).run(new Date().toISOString(), row.id);
        if (result.booking?.customer_email) {
          sendBookingConfirmation({
            customerEmail: result.booking.customer_email,
            customerName: result.booking.customer_name,
            bookingId: result.booking.booking_reference,
            checkIn: result.booking.entry_date,
            checkOut: result.booking.exit_date,
            parkingType: result.booking.parking_type,
            amount: result.booking.total_amount,
          }).catch(console.error);
        }
        entry.outcome = 'confirmed';
      } else {
        entry.outcome = 'not_paid_' + result.payment_status;
      }
    } catch (err) {
      entry.outcome = 'error: ' + err.message;
    }
    results.push(entry);
  }

  res.json({ total: rows.length, results });
});

// Temp debug — find which discount endpoint Base44 exposes
router.get('/debug-discount', async (req, res) => {
  const results = await debugDiscountEndpoints(req.query.code);
  res.json(results);
});

// Returns Base44's Stripe publishable key for frontend use
router.get('/stripe-key', async (req, res) => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Stripe key' });
  }
});

module.exports = router;
