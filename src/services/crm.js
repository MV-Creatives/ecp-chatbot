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

// Discount codes fetched live from Base44, cached for 5 minutes
let _discountCache = null;
let _discountCacheAt = 0;

async function fetchDiscountCodes() {
  if (_discountCache && Date.now() - _discountCacheAt < 5 * 60 * 1000) {
    return _discountCache;
  }
  try {
    const response = await crmClient.get('/getDiscountCodes');
    const items = Array.isArray(response.data) ? response.data : (response.data.codes || []);
    const map = {};
    items.forEach(function(c) {
      const status = (c.status || '').toLowerCase();
      const isActive = status === 'active' || status === 'enabled' || c.is_active === true;
      if (isActive && c.code) {
        map[c.code.toUpperCase()] = parseFloat(c.discount_percent || c.discount || 0);
      }
    });
    _discountCache = map;
    _discountCacheAt = Date.now();
    console.log('Discount codes loaded from Base44:', Object.keys(map));
    return map;
  } catch (err) {
    console.warn('Could not fetch discount codes from Base44, using fallback:', err.message);
    return _discountCache || { 'MVCREATIVES': 100 };
  }
}

async function applyDiscount(code) {
  if (!code) return null;
  const upper = code.toUpperCase().trim();
  const codes = await fetchDiscountCodes();
  const pct = codes[upper];
  if (pct !== undefined) return { valid: true, code: upper, percent: pct };
  return { valid: false, code: upper };
}

async function createBooking({
  checkIn, checkInTime, checkOut, checkOutTime, parkingType, purpose,
  vehicleRegistration, vehicleMake,
  customerName, customerEmail, customerPhone,
  discountCode,
}) {
  const discount = await applyDiscount(discountCode);

  if (discount && !discount.valid) {
    throw new Error(`INVALID_DISCOUNT_CODE:${discount.code}`);
  }

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
    ...(discount && { discount_code: discount.code, discount_percent: discount.percent }),
  };

  console.log('Creating booking with payload:', JSON.stringify(payload));

  try {
    const response = await crmClient.get('/createBookingFromChat', { params: payload });
    console.log('Booking created:', JSON.stringify(response.data));
    return response.data;
  } catch (err) {
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

module.exports = { checkAvailability, createBooking, getCruiseSchedule, verifyPayment, getStripePublishableKey };
