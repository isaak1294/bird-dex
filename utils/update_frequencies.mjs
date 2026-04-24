import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

// Ensure columns exist
try { await client.execute('ALTER TABLE birds ADD COLUMN frequency REAL'); console.log('Added frequency column'); }
catch { console.log('frequency column already exists'); }

try { await client.execute('ALTER TABLE birds ADD COLUMN is_target INTEGER NOT NULL DEFAULT 0'); console.log('Added is_target column'); }
catch { console.log('is_target column already exists'); }

// Parse CSV — last comma separates name from frequency percentage
const csv = readFileSync(join(__dirname, 'bc_common_birds.csv'), 'utf-8');
const lines = csv.split('\n').slice(1);

const birds = [];
for (const line of lines) {
  const trimmed = line.trim().replace(/\r/g, '');
  if (!trimmed) continue;
  const lastComma = trimmed.lastIndexOf(',');
  if (lastComma === -1) continue;
  const name = trimmed.slice(0, lastComma).replace(/^"|"$/g, '').trim();
  const freqStr = trimmed.slice(lastComma + 1).replace(/^"|"$/g, '').replace('%', '').trim();
  const frequency = parseFloat(freqStr);
  if (name && !isNaN(frequency)) birds.push({ name, frequency });
}

console.log(`Parsed ${birds.length} birds from CSV`);

// Reset all is_target flags, then set from CSV
await client.execute('UPDATE birds SET is_target = 0, frequency = NULL');

let updated = 0;
const notFound = [];

for (const { name, frequency } of birds) {
  const res = await client.execute({
    sql: 'UPDATE birds SET frequency = ?, is_target = 1 WHERE name = ?',
    args: [frequency, name],
  });
  if (Number(res.rowsAffected) === 0) {
    notFound.push(name);
  } else {
    updated++;
  }
}

console.log(`Updated ${updated} / ${birds.length} birds`);
if (notFound.length > 0) {
  console.log(`\nNot matched in DB (${notFound.length}):`);
  notFound.forEach(n => console.log(' -', n));
}
