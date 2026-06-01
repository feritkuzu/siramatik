import Database from 'better-sqlite3';

const db = new Database('./siramatik.db');
const banks = db.prepare('SELECT id, bank_number, is_active FROM banks LIMIT 5').all();
console.log('Banks:', JSON.stringify(banks, null, 2));
db.close();
