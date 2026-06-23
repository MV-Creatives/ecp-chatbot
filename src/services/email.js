const axios = require('axios');

const resend = axios.create({
  baseURL: 'https://api.resend.com',
  headers: {
    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

async function sendEmail({ to, subject, html }) {
  const response = await resend.post('/emails', {
    from: process.env.FROM_EMAIL || 'info@eastcoastparking.com.au',
    to,
    subject,
    html,
  });
  console.log('Email sent via Resend:', response.data.id);
  return response.data;
}

async function sendEscalationAlert({ sessionId, userMessage, sentiment, reason, customerName, customerEmail, customerPhone }) {
  return sendEmail({
    to: process.env.STAFF_EMAIL || 'bookings@eastcoastparking.com.au',
    subject: sentiment === 'negative'
      ? '🚨 Urgent: Frustrated Customer Needs Help'
      : '💬 Customer Requesting Agent Assistance',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #dde4eb;border-radius:12px;overflow:hidden;">
        <div style="background:#1a5276;padding:20px 24px;">
          <h1 style="color:white;margin:0;font-size:20px;">🅿️ East Coast Parking — Team Alert</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="color:#1a5276;margin-top:0;">Customer Needs Assistance</h2>

          ${customerName || customerEmail || customerPhone ? `
          <div style="background:#e8f4fd;border-left:4px solid #1a5276;padding:12px 16px;border-radius:4px;margin-bottom:16px;">
            <strong style="color:#1a5276;">Customer Contact Details</strong><br><br>
            ${customerName  ? `👤 <strong>Name:</strong> ${customerName}<br>` : ''}
            ${customerEmail ? `📧 <strong>Email:</strong> <a href="mailto:${customerEmail}">${customerEmail}</a><br>` : ''}
            ${customerPhone ? `📞 <strong>Phone:</strong> <a href="tel:${customerPhone}">${customerPhone}</a>` : ''}
          </div>` : ''}

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <tr>
              <td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;width:140px;border:1px solid #dde4eb;">Sentiment</td>
              <td style="padding:8px 12px;border:1px solid #dde4eb;">${sentiment === 'negative' ? '😡 Frustrated' : '😐 Neutral'}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Reason</td>
              <td style="padding:8px 12px;border:1px solid #dde4eb;">${reason || 'Customer requested agent'}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Session ID</td>
              <td style="padding:8px 12px;border:1px solid #dde4eb;font-size:12px;color:#888;">${sessionId}</td>
            </tr>
          </table>

          <div style="background:#fff8e1;border-left:4px solid #f9a825;padding:12px 16px;border-radius:4px;margin-bottom:20px;">
            <strong>Customer's message:</strong><br><br>
            <span style="color:#555;">"${userMessage}"</span>
          </div>

          <a href="https://reservations.eastcoastparking.com.au/Dashboard"
             style="display:inline-block;background:#1a5276;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Open Dashboard →
          </a>
        </div>
        <div style="background:#f8f9fa;padding:14px 24px;font-size:12px;color:#888;">
          East Coast Parking · 99 Main Beach Rd, Pinkenba QLD 4008 · 0404 094 064
        </div>
      </div>
    `,
  });
}

async function sendBookingConfirmation({ customerEmail, customerName, bookingReference, checkIn, checkInTime, checkOut, checkOutTime, parkingType, totalAmount, discountPercent, originalAmount }) {
  const parkingLabel = parkingType === 'undercover' ? 'Undercover (Valet)' : 'Open Air';
  const isFree = totalAmount === 0;
  const discountRow = discountPercent > 0 ? `
    <tr>
      <td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Discount</td>
      <td style="padding:8px 12px;border:1px solid #dde4eb;color:#27ae60;">${discountPercent}% off — saving $${originalAmount.toFixed(2)}</td>
    </tr>` : '';
  return sendEmail({
    to: customerEmail,
    subject: `Booking Confirmed – East Coast Parking (${bookingReference})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #dde4eb;border-radius:12px;overflow:hidden;">
        <div style="background:#ff751f;padding:20px 24px;">
          <h1 style="color:white;margin:0;font-size:20px;">East Coast Parking</h1>
          <p style="color:rgba(255,255,255,.85);margin:4px 0 0;">Booking Confirmation</p>
        </div>
        <div style="padding:24px;">
          <h2 style="color:#ff751f;margin-top:0;">You're all booked, ${customerName}!</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr>
              <td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;width:140px;border:1px solid #dde4eb;">Booking Ref</td>
              <td style="padding:8px 12px;border:1px solid #dde4eb;font-weight:bold;color:#ff751f;">${bookingReference}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Parking Type</td>
              <td style="padding:8px 12px;border:1px solid #dde4eb;">${parkingLabel}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Check-In</td>
              <td style="padding:8px 12px;border:1px solid #dde4eb;">${checkIn}${checkInTime ? ' at ' + checkInTime : ''}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Check-Out</td>
              <td style="padding:8px 12px;border:1px solid #dde4eb;">${checkOut}${checkOutTime ? ' at ' + checkOutTime : ''}</td>
            </tr>
            ${discountRow}
            <tr>
              <td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Total</td>
              <td style="padding:8px 12px;border:1px solid #dde4eb;font-weight:bold;">${isFree ? 'No charge' : '$' + totalAmount + ' AUD'}</td>
            </tr>
          </table>
          <div style="background:#fff4ee;border-left:4px solid #ff751f;padding:12px 16px;border-radius:4px;margin-bottom:20px;">
            🚌 <strong>Free shuttle</strong> runs constantly — approx. 15 min to Brisbane International Cruise Terminal.<br><br>
            📍 <strong>Address:</strong> 99 Main Beach Rd, Pinkenba QLD 4008
          </div>
          <p style="color:#666;font-size:13px;">⚠️ <strong>Cancellation policy:</strong> 72-hour notice required. $25 fee applies.</p>
          <p style="color:#666;font-size:13px;">Questions? Call <strong>0404 094 064</strong> or email <a href="mailto:info@eastcoastparking.com.au">info@eastcoastparking.com.au</a></p>
        </div>
        <div style="background:#f8f9fa;padding:14px 24px;font-size:12px;color:#888;">
          East Coast Parking · 99 Main Beach Rd, Pinkenba QLD 4008 · 0404 094 064
        </div>
      </div>
    `,
  });
}

async function sendStaffBookingAlert({ bookingReference, customerName, customerEmail, customerPhone, checkIn, checkInTime, checkOut, checkOutTime, parkingType, vehicleRegistration, vehicleMake, totalAmount, discountPercent }) {
  const parkingLabel = parkingType === 'undercover' ? 'Undercover (Valet)' : 'Open Air';
  return sendEmail({
    to: process.env.STAFF_EMAIL || 'info@eastcoastparking.com.au',
    subject: `New Booking via Chatbot — ${bookingReference} (${customerName})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #dde4eb;border-radius:12px;overflow:hidden;">
        <div style="background:#ff751f;padding:20px 24px;">
          <h1 style="color:white;margin:0;font-size:20px;">East Coast Parking — New Booking</h1>
          <p style="color:rgba(255,255,255,.85);margin:4px 0 0;">Received via AI Chatbot</p>
        </div>
        <div style="padding:24px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;width:160px;border:1px solid #dde4eb;">Reference</td><td style="padding:8px 12px;border:1px solid #dde4eb;font-weight:bold;color:#ff751f;">${bookingReference}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Customer</td><td style="padding:8px 12px;border:1px solid #dde4eb;">${customerName}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Email</td><td style="padding:8px 12px;border:1px solid #dde4eb;"><a href="mailto:${customerEmail}">${customerEmail}</a></td></tr>
            <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Phone</td><td style="padding:8px 12px;border:1px solid #dde4eb;"><a href="tel:${customerPhone}">${customerPhone}</a></td></tr>
            <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Vehicle</td><td style="padding:8px 12px;border:1px solid #dde4eb;">${vehicleMake} — ${vehicleRegistration}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Parking</td><td style="padding:8px 12px;border:1px solid #dde4eb;">${parkingLabel}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Check-In</td><td style="padding:8px 12px;border:1px solid #dde4eb;">${checkIn}${checkInTime ? ' at ' + checkInTime : ''}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Check-Out</td><td style="padding:8px 12px;border:1px solid #dde4eb;">${checkOut}${checkOutTime ? ' at ' + checkOutTime : ''}</td></tr>
            ${discountPercent > 0 ? `<tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Discount</td><td style="padding:8px 12px;border:1px solid #dde4eb;color:#27ae60;">${discountPercent}% applied</td></tr>` : ''}
            <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:bold;border:1px solid #dde4eb;">Total</td><td style="padding:8px 12px;border:1px solid #dde4eb;font-weight:bold;">${totalAmount === 0 ? 'No charge' : '$' + totalAmount + ' AUD'}</td></tr>
          </table>
          <a href="https://reservations.eastcoastparking.com.au/Bookings"
             style="display:inline-block;background:#ff751f;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            View in Dashboard →
          </a>
        </div>
        <div style="background:#f8f9fa;padding:14px 24px;font-size:12px;color:#888;">
          East Coast Parking · 99 Main Beach Rd, Pinkenba QLD 4008 · 0404 094 064
        </div>
      </div>
    `,
  });
}

module.exports = { sendEscalationAlert, sendBookingConfirmation, sendStaffBookingAlert };
