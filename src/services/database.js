const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(process.env.DATABASE_PATH || path.join(dbDir, 'chatbot.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
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

// Migrate existing DBs that predate the payment_url column
try { db.exec('ALTER TABLE bookings ADD COLUMN payment_url TEXT'); } catch(e) {}

console.log('Database ready');

module.exports = { db };
