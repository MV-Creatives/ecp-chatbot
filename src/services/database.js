const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./data/chatbot.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Wrapper matching better-sqlite3 call patterns (but returns Promises)
const db = {
  prepare: (sql) => ({
    get:  (...args) => client.execute({ sql, args: args.flat() }).then(r => r.rows[0] || null),
    all:  (...args) => client.execute({ sql, args: args.flat() }).then(r => r.rows),
    run:  (...args) => client.execute({ sql, args: args.flat() }),
  }),
  exec: (sql) => client.executeMultiple(sql),
};

async function initDb() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT,
      user_message TEXT NOT NULL,
      bot_response TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      conversation_type TEXT DEFAULT 'inquiry',
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_history(timestamp);
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      crm_booking_id TEXT,
      parking_type TEXT NOT NULL,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      vehicle_type TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      amount REAL,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid',
      payment_intent_id TEXT,
      payment_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_booking_session ON bookings(session_id);
    CREATE INDEX IF NOT EXISTS idx_booking_status ON bookings(status);
    CREATE TABLE IF NOT EXISTS escalations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_message TEXT NOT NULL,
      sentiment TEXT,
      reason TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT NOT NULL
    );
  `);

  try { await client.execute('ALTER TABLE bookings ADD COLUMN payment_url TEXT'); } catch(e) {}

  console.log('Database ready');
}

module.exports = { db, initDb };
