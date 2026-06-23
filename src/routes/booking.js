const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { checkAvailability, createBooking } = require('../services/crm');
const { sendBookingConfirmation } = require('../services/email');
const { db } = require('../services/database');

router.post('/check-availability', async (req, res) => {
  const { checkIn, checkOut, parkingType } = req.body;

  if (!checkIn || !checkOut || !parkingType) {
    return res.status(400).json({ error: 'checkIn, checkOut, and parkingType are required' });
  }
  if (!['open_air', 'undercover'].includes(parkingType)) {
    return res.status(400).json({ error: 'parkingType must be "open_air" or "undercover"' });
  }

  try {
    const availability = await checkAvailability({ checkIn, checkOut, parkingType });
    res.json(availability);
  } catch (err) {
    console.error('Availability check error:', err);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

router.post('/create', async (req, res) => {
  const {
    sessionId,
    checkIn, checkOut, parkingType, purpose,
    vehicleRegistration, vehicleMake,
    customerName, customerEmail, customerPhone,
  } = req.body;

  if (!checkIn || !checkOut || !parkingType || !customerName || !customerEmail) {
    return res.status(400).json({ error: 'Missing required booking fields' });
  }

  try {
    // Base44 creates the booking AND the Stripe checkout in one call
    const crmResult = await createBooking({
      checkIn, checkOut, parkingType, purpose,
      vehicleRegistration, vehicleMake,
      customerName, customerEmail, customerPhone,
    });

    if (!crmResult.success) {
      return res.status(400).json({ error: 'CRM rejected the booking request' });
    }

    const bookingId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO bookings (id, session_id, crm_booking_id, parking_type, check_in, check_out,
        customer_name, customer_email, customer_phone, amount, status, payment_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?, ?)
    `).run(
      bookingId, sessionId || null, crmResult.booking_id,
      parkingType, checkIn, checkOut,
      customerName, customerEmail, customerPhone || null,
      crmResult.total_amount || null, now, now
    );

    res.json({
      bookingId,
      bookingReference: crmResult.booking_reference,
      totalAmount: crmResult.total_amount,
      paymentUrl: crmResult.payment_url,  // Stripe checkout URL from Base44
      message: 'Booking created. Use the payment link to confirm your spot.',
    });
  } catch (err) {
    console.error('Booking creation error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

router.get('/:bookingId', (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json(booking);
});

module.exports = router;
