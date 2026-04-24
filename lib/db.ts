import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_TOKEN!,
});

let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await initSchema();
      await seedBirds();
      await migrateToMultiUser();
    })();
  }
  return initPromise;
}

async function initSchema() {
  // Canonical bird list — no user-specific columns
  await client.execute(`
    CREATE TABLE IF NOT EXISTS birds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      discovered INTEGER NOT NULL DEFAULT 0,
      field_notes TEXT NOT NULL DEFAULT '',
      cover_photo_id INTEGER,
      frequency REAL,
      is_target INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Legacy migrations for existing DBs
  try { await client.execute('ALTER TABLE birds ADD COLUMN cover_photo_id INTEGER'); } catch { /* exists */ }
  try { await client.execute('ALTER TABLE birds ADD COLUMN frequency REAL'); } catch { /* exists */ }
  try { await client.execute('ALTER TABLE birds ADD COLUMN is_target INTEGER NOT NULL DEFAULT 0'); } catch { /* exists */ }

  // Old photos table — kept so migrateToMultiUser can read from it
  await client.execute(`
    CREATE TABLE IF NOT EXISTS bird_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bird_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bird_id) REFERENCES birds(id) ON DELETE CASCADE
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      region TEXT NOT NULL DEFAULT 'BC',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_birds (
      user_id INTEGER NOT NULL,
      bird_id INTEGER NOT NULL,
      discovered INTEGER NOT NULL DEFAULT 0,
      field_notes TEXT NOT NULL DEFAULT '',
      cover_photo_id INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, bird_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (bird_id) REFERENCES birds(id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bird_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (bird_id) REFERENCES birds(id)
    )
  `);
}

function parseCSVLine(line: string): [string, string] | null {
  const trimmed = line.trim().replace(/\r/g, '');
  if (!trimmed) return null;
  let inQuotes = false;
  let commaIdx = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '"') inQuotes = !inQuotes;
    else if (trimmed[i] === ',' && !inQuotes) { commaIdx = i; break; }
  }
  if (commaIdx === -1) return null;
  const name = trimmed.slice(0, commaIdx).replace(/^"|"$/g, '').trim();
  const category = trimmed.slice(commaIdx + 1).replace(/^"|"$/g, '').trim();
  return name && category ? [name, category] : null;
}

async function seedBirds() {
  const result = await client.execute('SELECT COUNT(*) as count FROM birds');
  if (Number(result.rows[0].count) > 0) return;

  const csvPath = path.join(process.cwd(), 'utils', 'bc_birds_list.csv');
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');
  const rows: Array<[string, string]> = [];
  for (const line of lines.slice(1)) {
    const parsed = parseCSVLine(line);
    if (parsed) rows.push(parsed);
  }
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await client.batch(
      chunk.map(([name, category]) => ({
        sql: 'INSERT INTO birds (name, category) VALUES (?, ?)',
        args: [name, category],
      })),
      'write'
    );
  }
}

async function migrateToMultiUser() {
  const check = await client.execute("SELECT id FROM users WHERE username = 'isaak'");
  if (check.rows.length > 0) return;

  const res = await client.execute("INSERT INTO users (username, region) VALUES ('isaak', 'BC')");
  const isaakId = Number(res.lastInsertRowid);

  // Migrate birds with non-default values
  const birds = await client.execute(
    "SELECT id, discovered, field_notes, cover_photo_id, updated_at FROM birds WHERE discovered = 1 OR field_notes != '' OR cover_photo_id IS NOT NULL"
  );
  const chunkSize = 50;
  for (let i = 0; i < birds.rows.length; i += chunkSize) {
    await client.batch(
      birds.rows.slice(i, i + chunkSize).map(b => ({
        sql: 'INSERT OR IGNORE INTO user_birds (user_id, bird_id, discovered, field_notes, cover_photo_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [isaakId, b.id, b.discovered ?? 0, b.field_notes ?? '', b.cover_photo_id ?? null, b.updated_at],
      })),
      'write'
    );
  }

  // Migrate photos
  const photos = await client.execute('SELECT * FROM bird_photos');
  for (let i = 0; i < photos.rows.length; i += chunkSize) {
    await client.batch(
      photos.rows.slice(i, i + chunkSize).map(p => ({
        sql: 'INSERT OR IGNORE INTO user_photos (id, user_id, bird_id, url, caption, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [p.id, isaakId, p.bird_id, p.url, p.caption ?? '', p.created_at],
      })),
      'write'
    );
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export type User = {
  id: number;
  username: string;
  region: string;
  created_at: string;
};

export type Bird = {
  id: number;
  name: string;
  category: string;
  discovered: 0 | 1;
  field_notes: string;
  cover_photo_id: number | null;
  frequency: number | null;
  is_target: 0 | 1;
  updated_at: string;
  photos: Photo[];
};

export type Photo = {
  id: number;
  bird_id: number;
  url: string;
  caption: string;
  created_at: string;
};

// ── User functions ────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<User[]> {
  await ensureInit();
  const res = await client.execute(
    "SELECT * FROM users WHERE username NOT LIKE 'test%' ORDER BY username"
  );
  return res.rows.map(rowToUser);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  await ensureInit();
  const res = await client.execute({
    sql: 'SELECT * FROM users WHERE username = ? COLLATE NOCASE',
    args: [username],
  });
  if (!res.rows[0]) return null;
  return rowToUser(res.rows[0]);
}

export async function createUser(username: string, region: string): Promise<User> {
  await ensureInit();
  const res = await client.execute({
    sql: 'INSERT INTO users (username, region) VALUES (?, ?)',
    args: [username.toLowerCase().trim(), region],
  });
  const row = await client.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [Number(res.lastInsertRowid)],
  });
  return rowToUser(row.rows[0]);
}

// ── Bird functions (user-scoped) ──────────────────────────────────────────────

const USER_BIRD_SELECT = `
  SELECT b.id, b.name, b.category, b.frequency, b.is_target,
    COALESCE(ub.discovered, 0) as discovered,
    COALESCE(ub.field_notes, '') as field_notes,
    ub.cover_photo_id,
    COALESCE(ub.updated_at, b.updated_at) as updated_at
  FROM birds b
  LEFT JOIN user_birds ub ON b.id = ub.bird_id AND ub.user_id = ?
`;

export async function getAllUserBirds(userId: number): Promise<Bird[]> {
  await ensureInit();
  const [birdsRes, photosRes] = await Promise.all([
    client.execute({ sql: USER_BIRD_SELECT + ' ORDER BY b.id', args: [userId] }),
    client.execute({ sql: 'SELECT * FROM user_photos WHERE user_id = ? ORDER BY created_at', args: [userId] }),
  ]);
  const photosByBird = new Map<number, Photo[]>();
  for (const row of photosRes.rows) {
    const photo = rowToPhoto(row);
    const arr = photosByBird.get(photo.bird_id) ?? [];
    arr.push(photo);
    photosByBird.set(photo.bird_id, arr);
  }
  return birdsRes.rows.map(row => ({
    ...rowToBird(row),
    photos: photosByBird.get(Number(row.id)) ?? [],
  }));
}

export async function getUserBirdById(userId: number, birdId: number): Promise<Bird | null> {
  await ensureInit();
  const [birdRes, photosRes] = await Promise.all([
    client.execute({ sql: USER_BIRD_SELECT + ' WHERE b.id = ?', args: [userId, birdId] }),
    client.execute({ sql: 'SELECT * FROM user_photos WHERE user_id = ? AND bird_id = ? ORDER BY created_at', args: [userId, birdId] }),
  ]);
  if (!birdRes.rows[0]) return null;
  return { ...rowToBird(birdRes.rows[0]), photos: photosRes.rows.map(rowToPhoto) };
}

export async function updateUserBird(
  userId: number,
  birdId: number,
  data: { discovered?: 0 | 1; field_notes?: string; cover_photo_id?: number | null }
) {
  await ensureInit();
  await client.execute({ sql: 'INSERT OR IGNORE INTO user_birds (user_id, bird_id) VALUES (?, ?)', args: [userId, birdId] });

  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  if (data.discovered !== undefined) { fields.push('discovered = ?'); args.push(data.discovered); }
  if (data.field_notes !== undefined) { fields.push('field_notes = ?'); args.push(data.field_notes); }
  if ('cover_photo_id' in data) { fields.push('cover_photo_id = ?'); args.push(data.cover_photo_id ?? null); }
  if (!fields.length) return;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  args.push(userId, birdId);
  await client.execute({ sql: `UPDATE user_birds SET ${fields.join(', ')} WHERE user_id = ? AND bird_id = ?`, args });
}

export async function addUserPhoto(userId: number, birdId: number, url: string, caption: string): Promise<Photo> {
  await ensureInit();
  const result = await client.execute({
    sql: 'INSERT INTO user_photos (user_id, bird_id, url, caption) VALUES (?, ?, ?, ?)',
    args: [userId, birdId, url, caption],
  });
  // Auto-mark discovered
  await client.execute({ sql: 'INSERT OR IGNORE INTO user_birds (user_id, bird_id) VALUES (?, ?)', args: [userId, birdId] });
  await client.execute({ sql: 'UPDATE user_birds SET discovered = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND bird_id = ?', args: [userId, birdId] });

  const row = await client.execute({ sql: 'SELECT * FROM user_photos WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return rowToPhoto(row.rows[0]);
}

export async function deleteUserPhoto(userId: number, photoId: number): Promise<Photo | null> {
  await ensureInit();
  const res = await client.execute({ sql: 'SELECT * FROM user_photos WHERE id = ? AND user_id = ?', args: [photoId, userId] });
  if (!res.rows[0]) return null;
  const photo = rowToPhoto(res.rows[0]);
  await client.batch([
    { sql: 'UPDATE user_birds SET cover_photo_id = NULL WHERE user_id = ? AND cover_photo_id = ?', args: [userId, photoId] },
    { sql: 'DELETE FROM user_photos WHERE id = ? AND user_id = ?', args: [photoId, userId] },
  ], 'write');
  return photo;
}

// ── Row mappers ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(row: any): User {
  return {
    id: Number(row.id),
    username: String(row.username),
    region: String(row.region),
    created_at: String(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBird(row: any): Omit<Bird, 'photos'> {
  return {
    id: Number(row.id),
    name: String(row.name),
    category: String(row.category),
    discovered: Number(row.discovered) as 0 | 1,
    field_notes: String(row.field_notes ?? ''),
    cover_photo_id: row.cover_photo_id != null ? Number(row.cover_photo_id) : null,
    frequency: row.frequency != null ? Number(row.frequency) : null,
    is_target: (Number(row.is_target) || 0) as 0 | 1,
    updated_at: String(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPhoto(row: any): Photo {
  return {
    id: Number(row.id),
    bird_id: Number(row.bird_id),
    url: String(row.url),
    caption: String(row.caption ?? ''),
    created_at: String(row.created_at),
  };
}
