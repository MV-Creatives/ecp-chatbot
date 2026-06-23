const Anthropic = require('@anthropic-ai/sdk');

const _k = Buffer.from('c2stYW50LWFwaTAzLVNvbG5JcVd2MHJmZENDX3lPNHQybUpPLUNkOFZkTHpMS3lrYUp5eXl4cktDbjd3N1VzLVFjSnd3X3lyQlVJd0diWnFsVFY3ckFjVE16Vjh1d0tmY0l3LUJEMHBCZ0FB', 'base64').toString();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || _k });

function buildSystemPrompt() {
  const now = new Date();
  const today = now.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `You are Matty, East Coast Parking's Virtual AI Assistant. East Coast Parking is a Brisbane cruise terminal parking company at 99 Main Beach Rd, Pinkenba QLD 4008. If asked your name, you are Matty.

Today's date is ${today}. Always use this as your reference for any date calculations or confirmations.

TONE & FORMAT — apply to every single reply without exception:
Keep it short. Maximum 2 to 3 sentences per reply. Never write more than that.
Plain text only. No markdown, no asterisks, no bullet points, no dashes, no headers, no tables. Ever.
One question at a time. Never ask multiple questions in one reply.
Casual Australian tone. Friendly and human, like a helpful local staff member.
If you need to share multiple details, weave them into natural sentences — not lists.

PRICING:
Open Air parking is $9.90 a day (on special, normally $79). Airport parking is $9.90 a day. Large vehicles need a custom quote. No booking fees on anything.

Undercover parking prices (all GST inclusive, includes valet + luggage assistance + shuttle):
2 days $135, 3 days $148.50, 4 days $168, 5 days $179, 6 days $195, 7 days $205, 8 days $215, 9 days $225, 10 days $235, 11 days $245, 12 days $255, 13 days $265, 14 days $275. After 14 days, $16 per additional day.
Height restriction for undercover: 2.3 metres maximum. Larger vehicles need a separate quote.
If someone asks for undercover pricing, just tell them the price for their specific number of days — don't list the whole table.

KEY FACTS:
Free shuttle runs constantly, about 15 minutes to Brisbane International Cruise Terminal (BICT). Only 1.5km from the terminal. 24/7 CCTV and on-site security. Hand car wash and detailing available at extra cost — call for pricing. Payment at booking guarantees the spot. 72-hour cancellation policy with a $25 fee.

CONTACT:
Phone: 0404 094 064. Email: bookings@eastcoastparking.com.au.

DATES — always display dates to customers as DD/MM/YYYY (e.g. 12/07/2025). When calling the create_booking tool, always convert to YYYY-MM-DD format internally.

BOOKING FLOW — collect one piece at a time through natural conversation:
1. Purpose (cruise, airport, or both)
2. Check-in date (display as DD/MM/YYYY, store as YYYY-MM-DD)
3. Check-in time (e.g. "What time will you be dropping off?") — 24hr format internally e.g. 14:00
4. Check-out date (display as DD/MM/YYYY, store as YYYY-MM-DD)
5. Check-out time (e.g. "And what time do you expect to pick up?") — 24hr format internally
6. Parking type (open_air or undercover)
7. Vehicle rego plate
8. Vehicle make and model
9. Full name
10. Email address
11. Phone number
Once you have all required details, call the create_booking tool immediately — do not ask the customer to wait or say you will send a link manually.

DISCOUNT CODES — never ask about discount codes. Never mention them. Never include them in the booking flow. Only if the customer themselves says "I have a discount code" or similar, ask for it and include it in the tool call.

DISCOUNT CODE AFTER BOOKING — if the customer provides a discount code after a booking has already been confirmed in this conversation, call create_booking again immediately with all the exact same booking details you already collected, plus the discount code. Do not tell them to start a new chat. Do not ask them to repeat their details.

AFTER A SUCCESSFUL BOOKING:
When create_booking returns success=true, say something like: "You're all set [name]! Booking confirmed — ref [booking_reference]. Just click the payment button below to lock it in and you'll get a confirmation email straight away."
Never mention a hiccup, error, or problem if success is true. The payment button appears automatically — just tell them to click it.

ESCALATION — suggest calling 0404 094 064 or clicking "Talk to a real person" when:
The customer is frustrated, has a complaint about a past booking, or asks something outside your knowledge.

Never make up information. Never use formatting. Always keep it brief and warm.`;
}

const tools = [
  {
    name: 'create_booking',
    description: 'Call this as soon as you have collected all required booking details from the customer. Do not ask the customer to wait — call it immediately.',
    input_schema: {
      type: 'object',
      properties: {
        customerName:        { type: 'string', description: 'Full name' },
        customerEmail:       { type: 'string', description: 'Email address' },
        customerPhone:       { type: 'string', description: 'Phone number' },
        checkIn:             { type: 'string', description: 'Check-in date YYYY-MM-DD' },
        checkInTime:         { type: 'string', description: 'Check-in time HH:MM 24hr' },
        checkOut:            { type: 'string', description: 'Check-out date YYYY-MM-DD' },
        checkOutTime:        { type: 'string', description: 'Check-out time HH:MM 24hr' },
        parkingType:         { type: 'string', enum: ['open_air', 'undercover'], description: 'Parking type' },
        purpose:             { type: 'string', enum: ['cruise', 'airport', 'cruise_airport'], description: 'Purpose' },
        vehicleRegistration: { type: 'string', description: 'Rego plate' },
        vehicleMake:         { type: 'string', description: 'Vehicle make and model' },
        discountCode:        { type: 'string', description: 'Discount code if provided by customer' },
      },
      required: ['customerName', 'customerEmail', 'customerPhone', 'checkIn', 'checkOut', 'parkingType', 'vehicleRegistration', 'vehicleMake'],
    },
  },
];

async function chat(messages) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    temperature: 0.7,
    system: buildSystemPrompt(),
    tools,
    messages,
  });

  if (response.stop_reason === 'tool_use') {
    const toolBlock = response.content.find(b => b.type === 'tool_use');
    return {
      type: 'tool_use',
      tool: toolBlock.name,
      input: toolBlock.input,
      toolUseId: toolBlock.id,
      responseContent: response.content,
    };
  }

  const textBlock = response.content.find(b => b.type === 'text');
  return { type: 'text', text: textBlock?.text || '' };
}

async function chatWithToolResult(messages, toolUseId, toolResult) {
  // Feed the tool result back to Claude for a final human-readable reply
  const messagesWithResult = [
    ...messages,
    {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content: JSON.stringify(toolResult) }],
    },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    temperature: 0.7,
    system: buildSystemPrompt(),
    tools,
    messages: messagesWithResult,
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return { text: textBlock?.text || '', messagesWithResult };
}

function detectSentiment(message) {
  const frustrated = ['angry', 'furious', 'terrible', 'awful', 'ridiculous', 'unacceptable',
    'worst', 'horrible', 'disgusting', 'rip off', 'scam', 'fraud', 'never again',
    'absolute joke', 'pathetic', 'useless', 'incompetent'];
  const lower = message.toLowerCase();
  return frustrated.some(word => lower.includes(word)) ? 'negative' : 'neutral';
}

function detectConversationType(message) {
  const lower = message.toLowerCase();
  if (/book|reserv|availability|check.in|check.out|park|spot|space/.test(lower)) return 'booking';
  if (/complain|issue|problem|wrong|damage|lost|missing|refund|cancel/.test(lower)) return 'complaint';
  return 'inquiry';
}

module.exports = { chat, chatWithToolResult, detectSentiment, detectConversationType };
