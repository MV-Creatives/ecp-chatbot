const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createPaymentIntent({ amount, bookingId, customerEmail, metadata = {} }) {
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe uses cents
    currency: 'aud',
    receipt_email: customerEmail,
    metadata: {
      booking_id: bookingId,
      ...metadata,
    },
    description: `East Coast Parking - Booking ${bookingId}`,
  });
  return intent;
}

async function createCheckoutSession({ amount, bookingId, customerEmail, successUrl, cancelUrl }) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'aud',
          product_data: {
            name: 'East Coast Parking Reservation',
            description: `Booking reference: ${bookingId}`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    customer_email: customerEmail,
    success_url: successUrl || `${process.env.CRM_API_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${process.env.CRM_API_URL}/booking/cancel`,
    metadata: { booking_id: bookingId },
  });
  return session;
}

async function retrievePaymentIntent(paymentIntentId) {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

function constructWebhookEvent(payload, sig) {
  return stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { createPaymentIntent, createCheckoutSession, retrievePaymentIntent, constructWebhookEvent };
