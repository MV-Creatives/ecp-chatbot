const axios = require('axios');

const crmClient = axios.create({
  baseURL: 'https://reservations.eastcoastparking.com.au/functions',
  headers: {
    'Authorization': `Bearer ${process.env.CRM_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

async function checkAvailability({ checkIn, checkOut, parkingType }) {
  try {
    const response = await crmClient.post('/checkBlockedDates', {
      parking_type: parkingType,   // "open_air" | "undercover"
      entry_date: checkIn,
      exit_date: checkOut,
    });

    const { available, blocked_dates } = response.data;
    const days = daysBetween(checkIn, checkOut);
    const dailyRate = parkingType === 'undercover' ? null : 9.90;
    const total = parkingType === 'undercover' ? 135 : dailyRate * days;

    return {
      available,
      blocked_dates: blocked_dates || [],
      days,
      daily_rate: dailyRate,
      total_price: total,
      note: blocked_dates?.length
        ? `Note: some dates have limited availability (${blocked_dates.join(', ')})`
        : null,
    };
  } catch (err) {
    console.warn('CRM availability check failed, using mock:', err.message);
    return getMockAvailability({ checkIn, checkOut, parkingType });
  }
}

function normaliseCode(code) {
  return code ? code.toUpperCase().trim() : null;
}

async function createBooking({
  checkIn, checkInTime, checkOut, checkOutTime, parkingType, purpose,
  vehicleRegistration, vehicleMake,
  customerName, customerEmail, customerPhone,
  discountCode,
}) {
  const code = normaliseCode(discountCode);

  const payload = {
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    entry_date: checkIn,
    entry_time: checkInTime || '00:00',
    exit_date: checkOut,
    exit_time: checkOutTime || '23:59',
    parking_type: parkingType,
    purpose: purpose || 'cruise',
    vehicle_registration: vehicleRegistration || '',
    vehicle_make: vehicleMake || '',
    ...(code && { discount_code: code }),
  };

  console.log('Creating booking with payload:', JSON.stringify(payload));

  try {
    const response = await crmClient.get('/createBookingFromChat', { params: payload });
    console.log('Booking created:', JSON.stringify(response.data));
    const data = response.data;
    // If a code was sent but Base44 applied 0% discount, the code wasn't recognised
    if (code && (data.discount_percent === 0 || data.discount_percent === null || data.discount_percent === undefined)) {
      throw new Error(`INVALID_DISCOUNT_CODE:${code}`);
    }
    return data;
  } catch (err) {
    if (err.message.startsWith('INVALID_DISCOUNT_CODE:')) throw err;
    const detail = err.response?.data || err.message;
    console.error('Base44 booking error:', JSON.stringify(detail));
    throw new Error(typeof detail === 'object' ? JSON.stringify(detail) : detail);
  }
}

async function getCruiseSchedule() {
  try {
    const response = await crmClient.get('/getCruiseSchedule');
    return response.data;
  } catch (err) {
    console.warn('CRM cruise schedule fetch failed, using mock:', err.message);
    return getMockCruiseSchedule();
  }
}

async function verifyPayment(stripeSessionId) {
  const response = await crmClient.post('/verifyStripeSession', {
    session_id: stripeSessionId,
  });
  return response.data;
  // Returns: { booking: { ...all fields }, payment_status }
}

async function getStripePublishableKey() {
  const response = await axios.get(
    'https://reservations.eastcoastparking.com.au/functions/getStripePublishableKey'
  );
  return response.data.publishableKey;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(from, to) {
  return Math.max(1, Math.ceil(
    (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)
  ));
}

function getMockAvailability({ checkIn, checkOut, parkingType }) {
  const days = daysBetween(checkIn, checkOut);
  const total = parkingType === 'undercover' ? 135 : 9.90 * days;
  return {
    available: true,
    blocked_dates: [],
    days,
    daily_rate: parkingType === 'undercover' ? null : 9.90,
    total_price: total,
    note: null,
  };
}

function getMockCruiseSchedule() {
  const today = new Date();
  const cruises = [];
  for (let i = 1; i <= 5; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i * 7);
    cruises.push({
      ship_name: ['Ovation of the Seas', 'Carnival Splendor', 'Pacific Adventure'][i % 3],
      departure_date: date.toISOString().split('T')[0],
      terminal: 'BICT Brisbane',
    });
  }
  return { cruises };
}

async function debugDiscountEndpoints(code) {
  const results = {};
  const endpoints = ['/getDiscountCodes', '/listDiscountCodes', '/getPromos', '/validateDiscountCode'];
  for (const ep of endpoints) {
    try {
      const r = await crmClient.get(ep, code ? { params: { code } } : {});
      results[ep] = r.data;
    } catch(e) {
      results[ep] = 'error: ' + (e.response?.status || '') + ' ' + (e.response?.data?.message || e.message);
    }
  }
  return results;
}

module.exports = { checkAvailability, createBooking, getCruiseSchedule, verifyPayment, getStripePublishableKey, debugDiscountEndpoints };
