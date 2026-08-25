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
      await migrateToRegions();
      await migrateToFriends();
      await migrateToDiscoveredAt();
    })();
  }
  return initPromise;
}

async function initSchema() {
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
  try { await client.execute('ALTER TABLE birds ADD COLUMN cover_photo_id INTEGER'); } catch { /* exists */ }
  try { await client.execute('ALTER TABLE birds ADD COLUMN frequency REAL'); } catch { /* exists */ }
  try { await client.execute('ALTER TABLE birds ADD COLUMN is_target INTEGER NOT NULL DEFAULT 0'); } catch { /* exists */ }

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
      password TEXT NOT NULL DEFAULT 'a',
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

  await client.execute(`
    CREATE TABLE IF NOT EXISTS region_birds (
      region TEXT NOT NULL,
      bird_id INTEGER NOT NULL,
      frequency REAL,
      is_target INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (region, bird_id),
      FOREIGN KEY (bird_id) REFERENCES birds(id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS friendships (
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, friend_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (friend_id) REFERENCES users(id)
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

function parseSkCSVLine(line: string): [string, number] | null {
  const trimmed = line.trim().replace(/\r/g, '');
  if (!trimmed) return null;
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return null;
  const name = trimmed.slice(0, commaIdx).trim();
  const freqStr = trimmed.slice(commaIdx + 1).trim().replace('%', '');
  const freq = parseFloat(freqStr);
  return name && !isNaN(freq) ? [name, freq] : null;
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

async function migrateToRegions() {
  const bcCheck = await client.execute("SELECT COUNT(*) as count FROM region_birds WHERE region = 'BC'");
  if (Number(bcCheck.rows[0].count) === 0) {
    await client.execute(`
      INSERT OR IGNORE INTO region_birds (region, bird_id, frequency, is_target)
      SELECT 'BC', id, frequency, is_target FROM birds
    `);
  }

  const tableInfo = await client.execute('PRAGMA table_info(user_birds)');
  const hasRegion = tableInfo.rows.some(r => String(r.name) === 'region');
  if (!hasRegion) {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_birds_v2 (
        user_id INTEGER NOT NULL,
        bird_id INTEGER NOT NULL,
        region TEXT NOT NULL DEFAULT 'BC',
        discovered INTEGER NOT NULL DEFAULT 0,
        field_notes TEXT NOT NULL DEFAULT '',
        cover_photo_id INTEGER,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, bird_id, region),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (bird_id) REFERENCES birds(id)
      )
    `);
    await client.execute(`
      INSERT OR IGNORE INTO user_birds_v2 (user_id, bird_id, region, discovered, field_notes, cover_photo_id, updated_at)
      SELECT user_id, bird_id, 'BC', discovered, field_notes, cover_photo_id, updated_at FROM user_birds
    `);
    await client.execute('DROP TABLE user_birds');
    await client.execute('ALTER TABLE user_birds_v2 RENAME TO user_birds');
  }

  const skCheck = await client.execute("SELECT COUNT(*) as count FROM region_birds WHERE region = 'SK'");
  if (Number(skCheck.rows[0].count) === 0) {
    await seedSaskBirds();
  }
}

async function seedSaskBirds() {
  const csvPath = path.join(process.cwd(), 'utils', 'sask_common_birds.csv');
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');

  const saskBirds: Array<{ name: string; frequency: number }> = [];
  for (const line of lines.slice(1)) {
    const parsed = parseSkCSVLine(line);
    if (parsed) saskBirds.push({ name: parsed[0], frequency: parsed[1] });
  }

  const allBirds = await client.execute('SELECT id, name FROM birds');
  const birdByName = new Map<string, number>();
  for (const row of allBirds.rows) {
    birdByName.set(String(row.name).toLowerCase(), Number(row.id));
  }

  const toInsert: Array<{ bird_id: number; frequency: number }> = [];
  for (const { name, frequency } of saskBirds) {
    const existingId = birdByName.get(name.toLowerCase());
    if (existingId) {
      toInsert.push({ bird_id: existingId, frequency });
    } else {
      const result = await client.execute({
        sql: 'INSERT INTO birds (name, category) VALUES (?, ?)',
        args: [name, 'Other'],
      });
      toInsert.push({ bird_id: Number(result.lastInsertRowid), frequency });
    }
  }

  const chunkSize = 100;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    await client.batch(
      chunk.map(({ bird_id, frequency }) => ({
        sql: 'INSERT OR IGNORE INTO region_birds (region, bird_id, frequency, is_target) VALUES (?, ?, ?, ?)',
        args: ['SK', bird_id, frequency, 1],
      })),
      'write'
    );
  }
}

async function migrateToFriends() {
  // Add password column for existing DBs (DEFAULT 'a' covers all existing users)
  try {
    await client.execute("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT 'a'");
  } catch { /* already exists */ }

  // Make all existing non-isaak users friends with isaak
  const isaakRow = await client.execute("SELECT id FROM users WHERE username = 'isaak'");
  if (isaakRow.rows.length === 0) return;
  const isaakId = Number(isaakRow.rows[0].id);

  const others = await client.execute({
    sql: 'SELECT id FROM users WHERE id != ?',
    args: [isaakId],
  });
  if (others.rows.length === 0) return;

  const chunkSize = 50;
  for (let i = 0; i < others.rows.length; i += chunkSize) {
    await client.batch(
      others.rows.slice(i, i + chunkSize).flatMap(row => {
        const uid = Number(row.id);
        return [
          { sql: 'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)', args: [uid, isaakId] },
          { sql: 'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)', args: [isaakId, uid] },
        ];
      }),
      'write'
    );
  }
}

async function migrateToDiscoveredAt() {
  try { await client.execute('ALTER TABLE user_birds ADD COLUMN discovered_at TEXT'); } catch { /* exists */ }
  // Backfill: sightings that predate discovered_at tracking all count toward 2026.
  // No-op after the first run — every write path stamps discovered_at going forward.
  await client.execute(
    "UPDATE user_birds SET discovered_at = CURRENT_TIMESTAMP WHERE discovered = 1 AND (discovered_at IS NULL OR discovered_at < '2026-01-01')"
  );
}

// ── Quiz helpers ─────────────────────────────────────────────────────────────

export type BirdBasic = { id: number; name: string; category: string; frequency: number | null };

const RARITY_SQL: Record<string, string> = {
  common:    'frequency > 10',
  uncommon:  'frequency > 3 AND frequency <= 10',
  rare:      'frequency > 1 AND frequency <= 3',
  epic:      'frequency > 0.1 AND frequency <= 1',
  legendary: 'frequency IS NOT NULL AND frequency <= 0.1',
};

export async function getDistinctBirdCategories(): Promise<string[]> {
  await ensureInit();
  const res = await client.execute('SELECT DISTINCT category FROM birds ORDER BY category');
  return res.rows.map(r => String(r.category));
}

export async function getBirdsByCategory(
  category: string | null,
  rarities?: string[]
): Promise<BirdBasic[]> {
  await ensureInit();
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (category) { conditions.push('category = ?'); args.push(category); }

  if (rarities && rarities.length > 0) {
    const rarityConds = rarities.filter(r => RARITY_SQL[r]).map(r => `(${RARITY_SQL[r]})`);
    if (rarityConds.length > 0) conditions.push(`(${rarityConds.join(' OR ')})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await client.execute({
    sql: `SELECT id, name, category, frequency FROM birds ${where} ORDER BY name`,
    args,
  });
  return res.rows.map(r => ({
    id: Number(r.id),
    name: String(r.name),
    category: String(r.category),
    frequency: r.frequency != null ? Number(r.frequency) : null,
  }));
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
  discovered_at: string | null;
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

export async function validateUser(username: string, password: string): Promise<User | null> {
  await ensureInit();
  const res = await client.execute({
    sql: 'SELECT * FROM users WHERE username = ? COLLATE NOCASE',
    args: [username],
  });
  const row = res.rows[0];
  if (!row) return null;

  const { verifyPassword, hashPassword } = await import('./auth');
  const stored = String(row.password);
  if (!(await verifyPassword(password, stored))) return null;

  // Migrate legacy plaintext password to bcrypt on first successful login
  if (!stored.startsWith('$2')) {
    const hash = await hashPassword(password);
    await client.execute({
      sql: 'UPDATE users SET password = ? WHERE id = ?',
      args: [hash, Number(row.id)],
    });
  }

  return rowToUser(row);
}

export async function createUser(username: string, region: string, password: string): Promise<User> {
  await ensureInit();
  const { hashPassword } = await import('./auth');
  const hashed = await hashPassword(password);
  const res = await client.execute({
    sql: 'INSERT INTO users (username, region, password) VALUES (?, ?, ?)',
    args: [username.toLowerCase().trim(), region, hashed],
  });
  const newUserId = Number(res.lastInsertRowid);

  // Auto-friend with isaak (bidirectional)
  const isaakRow = await client.execute("SELECT id FROM users WHERE username = 'isaak'");
  if (isaakRow.rows.length > 0) {
    const isaakId = Number(isaakRow.rows[0].id);
    if (isaakId !== newUserId) {
      await client.batch([
        { sql: 'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)', args: [newUserId, isaakId] },
        { sql: 'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)', args: [isaakId, newUserId] },
      ], 'write');
    }
  }

  const row = await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [newUserId] });
  return rowToUser(row.rows[0]);
}

export async function updateUserRegion(username: string, region: string): Promise<User | null> {
  await ensureInit();
  await client.execute({
    sql: 'UPDATE users SET region = ? WHERE username = ? COLLATE NOCASE',
    args: [region, username],
  });
  return getUserByUsername(username);
}

export async function getUserFriends(userId: number): Promise<User[]> {
  await ensureInit();
  const res = await client.execute({
    sql: `SELECT u.* FROM users u
          WHERE (u.id = ? OR u.id IN (SELECT friend_id FROM friendships WHERE user_id = ?))
            AND u.username NOT LIKE 'test%'
          ORDER BY u.username`,
    args: [userId, userId],
  });
  return res.rows.map(rowToUser);
}

export async function addFriend(userId: number, friendId: number): Promise<void> {
  await ensureInit();
  await client.batch([
    { sql: 'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)', args: [userId, friendId] },
    { sql: 'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)', args: [friendId, userId] },
  ], 'write');
}

export async function removeFriend(userId: number, friendId: number): Promise<void> {
  await ensureInit();
  await client.batch([
    { sql: 'DELETE FROM friendships WHERE user_id = ? AND friend_id = ?', args: [userId, friendId] },
    { sql: 'DELETE FROM friendships WHERE user_id = ? AND friend_id = ?', args: [friendId, userId] },
  ], 'write');
}

// ── Bird functions (user-scoped, region-scoped) ───────────────────────────────

const REGION_BIRD_SELECT = `
  SELECT b.id, b.name, b.category, rb.frequency, rb.is_target,
    COALESCE(ub.discovered, 0) as discovered,
    ub.discovered_at,
    COALESCE(ub.field_notes, '') as field_notes,
    ub.cover_photo_id,
    COALESCE(ub.updated_at, b.updated_at) as updated_at
  FROM birds b
  JOIN region_birds rb ON b.id = rb.bird_id AND rb.region = ?
  LEFT JOIN user_birds ub ON b.id = ub.bird_id AND ub.user_id = ? AND ub.region = ?
`;

export async function getAllUserBirds(userId: number, region: string): Promise<Bird[]> {
  await ensureInit();
  const [birdsRes, photosRes] = await Promise.all([
    client.execute({ sql: REGION_BIRD_SELECT + ' ORDER BY b.id', args: [region, userId, region] }),
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

export async function getUserBirdById(userId: number, birdId: number, region: string): Promise<Bird | null> {
  await ensureInit();
  const [birdRes, photosRes] = await Promise.all([
    client.execute({ sql: REGION_BIRD_SELECT + ' WHERE b.id = ?', args: [region, userId, region, birdId] }),
    client.execute({ sql: 'SELECT * FROM user_photos WHERE user_id = ? AND bird_id = ? ORDER BY created_at', args: [userId, birdId] }),
  ]);
  if (!birdRes.rows[0]) return null;
  return { ...rowToBird(birdRes.rows[0]), photos: photosRes.rows.map(rowToPhoto) };
}

export async function updateUserBird(
  userId: number,
  birdId: number,
  region: string,
  data: { discovered?: 0 | 1; field_notes?: string; cover_photo_id?: number | null }
) {
  await ensureInit();
  await client.execute({
    sql: 'INSERT OR IGNORE INTO user_birds (user_id, bird_id, region) VALUES (?, ?, ?)',
    args: [userId, birdId, region],
  });

  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  if (data.discovered !== undefined) {
    fields.push('discovered = ?');
    args.push(data.discovered);
    // First sighting stamps discovered_at; un-marking clears it
    fields.push(
      data.discovered === 1
        ? 'discovered_at = COALESCE(discovered_at, CURRENT_TIMESTAMP)'
        : 'discovered_at = NULL'
    );
  }
  if (data.field_notes !== undefined) { fields.push('field_notes = ?'); args.push(data.field_notes); }
  if ('cover_photo_id' in data) { fields.push('cover_photo_id = ?'); args.push(data.cover_photo_id ?? null); }
  if (!fields.length) return;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  args.push(userId, birdId, region);
  await client.execute({
    sql: `UPDATE user_birds SET ${fields.join(', ')} WHERE user_id = ? AND bird_id = ? AND region = ?`,
    args,
  });
}

export async function addUserPhoto(
  userId: number,
  birdId: number,
  region: string,
  url: string,
  caption: string
): Promise<Photo> {
  await ensureInit();
  const result = await client.execute({
    sql: 'INSERT INTO user_photos (user_id, bird_id, url, caption) VALUES (?, ?, ?, ?)',
    args: [userId, birdId, url, caption],
  });
  await client.execute({
    sql: 'INSERT OR IGNORE INTO user_birds (user_id, bird_id, region) VALUES (?, ?, ?)',
    args: [userId, birdId, region],
  });
  await client.execute({
    sql: 'UPDATE user_birds SET discovered = 1, discovered_at = COALESCE(discovered_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND bird_id = ? AND region = ?',
    args: [userId, birdId, region],
  });

  const row = await client.execute({
    sql: 'SELECT * FROM user_photos WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  });
  return rowToPhoto(row.rows[0]);
}

export async function deleteUserPhoto(userId: number, photoId: number): Promise<Photo | null> {
  await ensureInit();
  const res = await client.execute({
    sql: 'SELECT * FROM user_photos WHERE id = ? AND user_id = ?',
    args: [photoId, userId],
  });
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
    // password intentionally excluded from public type
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBird(row: any): Omit<Bird, 'photos'> {
  return {
    id: Number(row.id),
    name: String(row.name),
    category: String(row.category),
    discovered: Number(row.discovered) as 0 | 1,
    discovered_at: row.discovered_at != null ? String(row.discovered_at) : null,
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
