const Database = require("better-sqlite3");

const db = new Database("tracker.db");

db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        supplier TEXT,
        reference TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        payment_method TEXT,
        reference TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reason TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY,
        store_name TEXT DEFAULT 'Tracker',
        phone TEXT DEFAULT '',
        address TEXT DEFAULT '',
        purchase_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        low_stock_limit INTEGER DEFAULT 10
    );
`);

const existingSettings = db
    .prepare("SELECT id FROM settings WHERE id = 1")
    .get();

if (!existingSettings) {
    db.prepare(`
        INSERT INTO settings (
            id,
            store_name,
            phone,
            address,
            purchase_price,
            selling_price,
            low_stock_limit
        )
        VALUES (1, ?, ?, ?, ?, ?, ?)
    `).run(
        "Tracker",
        "",
        "",
        0,
        0,
        10
    );
}

module.exports = db;