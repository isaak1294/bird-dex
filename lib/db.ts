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
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
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
  // Migrations — each wrapped individually so one failure doesn't block others
  try { await client.execute('ALTER TABLE birds ADD COLUMN cover_photo_id INTEGER'); } catch { /* exists */ }
  try { await client.execute('ALTER TABLE birds ADD COLUMN frequency REAL'); } catch { /* exists */ }
  try { await client.execute('ALTER TABLE birds ADD COLUMN is_target INTEGER NOT NULL DEFAULT 0'); } catch { /* exists */ }
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

  // Insert in chunks to stay within Turso batch limits
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

export async function getAllBirds(): Promise<Bird[]> {
  await ensureInit();
  const [birdsRes, photosRes] = await Promise.all([
    client.execute('SELECT * FROM birds ORDER BY id'),
    client.execute('SELECT * FROM bird_photos ORDER BY created_at'),
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

export async function getBirdById(id: number): Promise<Bird | null> {
  await ensureInit();
  const [birdRes, photosRes] = await Promise.all([
    client.execute({ sql: 'SELECT * FROM birds WHERE id = ?', args: [id] }),
    client.execute({ sql: 'SELECT * FROM bird_photos WHERE bird_id = ? ORDER BY created_at', args: [id] }),
  ]);
  if (!birdRes.rows[0]) return null;
  return {
    ...rowToBird(birdRes.rows[0]),
    photos: photosRes.rows.map(rowToPhoto),
  };
}

export async function updateBird(
  id: number,
  data: { discovered?: 0 | 1; field_notes?: string; cover_photo_id?: number | null }
) {
  await ensureInit();
  const fields: string[] = [];
  const args: (string | number | null)[] = [];

  if (data.discovered !== undefined) { fields.push('discovered = ?'); args.push(data.discovered); }
  if (data.field_notes !== undefined) { fields.push('field_notes = ?'); args.push(data.field_notes); }
  if ('cover_photo_id' in data) { fields.push('cover_photo_id = ?'); args.push(data.cover_photo_id ?? null); }
  if (!fields.length) return;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  args.push(id);
  await client.execute({ sql: `UPDATE birds SET ${fields.join(', ')} WHERE id = ?`, args });
}

export async function addPhoto(birdId: number, url: string, caption: string): Promise<Photo> {
  await ensureInit();
  const result = await client.execute({
    sql: 'INSERT INTO bird_photos (bird_id, url, caption) VALUES (?, ?, ?)',
    args: [birdId, url, caption],
  });
  const row = await client.execute({
    sql: 'SELECT * FROM bird_photos WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  });
  return rowToPhoto(row.rows[0]);
}

export async function deletePhoto(photoId: number): Promise<Photo | null> {
  await ensureInit();
  const res = await client.execute({ sql: 'SELECT * FROM bird_photos WHERE id = ?', args: [photoId] });
  if (!res.rows[0]) return null;
  const photo = rowToPhoto(res.rows[0]);
  await client.batch([
    { sql: 'UPDATE birds SET cover_photo_id = NULL WHERE cover_photo_id = ?', args: [photoId] },
    { sql: 'DELETE FROM bird_photos WHERE id = ?', args: [photoId] },
  ], 'write');
  return photo;
}

export async function getCategories(): Promise<Array<{ category: string; total: number; discovered: number }>> {
  await ensureInit();
  const res = await client.execute(
    'SELECT category, COUNT(*) as total, CAST(SUM(discovered) AS INTEGER) as discovered FROM birds GROUP BY category ORDER BY category'
  );
  return res.rows.map(row => ({
    category: String(row.category),
    total: Number(row.total),
    discovered: Number(row.discovered),
  }));
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
    is_target: (Number(row.is_target) as 0 | 1) ?? 0,
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
