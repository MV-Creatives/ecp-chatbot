const express = require('express');
const router = express.Router();
const { verifyPayment, getStripePublishableKey } = require('../services/crm');
const { sendBookingConfirmation } = require('../services/email');
const { db } = require('../services/database');

// Called after user completes Stripe payment — accepts either a Stripe session ID directly,
// or a booking reference (we look up the payment_url and extract the session ID from it).
router.post('/verify', async (req, res) => {
  let { sessionId: stripeSessionId, bookingId, bookingReference } = req.body;

  if (!stripeSessionId && bookingReference) {
    const row = db.prepare(
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
      db.prepare(`
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
