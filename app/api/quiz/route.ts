import type { NextRequest } from 'next/server';
import { getBirdsByCategory } from '@/lib/db';
import type { BirdBasic } from '@/lib/db';

type InatMedia = {
  type: 'photo' | 'sound';
  url: string;
  attribution: string;
  observationUrl: string;
};

function isIdentifiable(name: string): boolean {
  return !/(hybrid|\bx\s|\bsp\.|\bsp$|\/)/i.test(name);
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickRandom(results: any[]): any | null {
  // Skip top 3 (most-voted = famous shots / rare morphs), pick randomly from rest
  const pool = results.slice(3);
  return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
}

async function fetchInatPhoto(birdName: string): Promise<InatMedia | null> {
  const url = new URL('https://api.inaturalist.org/v1/observations');
  url.searchParams.set('taxon_name', birdName);
  url.searchParams.set('quality_grade', 'research');
  url.searchParams.set('per_page', '20');
  url.searchParams.set('order_by', 'votes');
  url.searchParams.append('has[]', 'photos');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'bird-dex/1.0 (educational quiz app)' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const obs = pickRandom((data.results ?? []).filter((o: { photos?: { url?: string }[] }) => o.photos?.[0]?.url));
    if (!obs) return null;
    const photo = obs.photos[0];
    return {
      type: 'photo',
      url: photo.url.replace('/square.', '/medium.'),
      attribution: photo.attribution ?? `© ${obs.user?.login ?? 'unknown'}`,
      observationUrl: `https://www.inaturalist.org/observations/${obs.id}`,
    };
  } catch {
    return null;
  }
}

async function fetchInatSound(birdName: string): Promise<InatMedia | null> {
  const url = new URL('https://api.inaturalist.org/v1/observations');
  url.searchParams.set('taxon_name', birdName);
  url.searchParams.set('quality_grade', 'research');
  url.searchParams.set('per_page', '20');
  url.searchParams.set('order_by', 'votes');
  url.searchParams.append('has[]', 'sounds');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'bird-dex/1.0 (educational quiz app)' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const eligible = (data.results ?? []).filter((o: { sounds?: { file_url?: string }[] }) => o.sounds?.[0]?.file_url).slice(0, 10);
    const obs = eligible[Math.floor(Math.random() * eligible.length)];
    if (!obs) return null;
    const sound = obs.sounds[0];
    return {
      type: 'sound',
      url: sound.file_url,
      attribution: sound.attribution ?? `© ${obs.user?.login ?? 'unknown'}`,
      observationUrl: `https://www.inaturalist.org/observations/${obs.id}`,
    };
  } catch {
    return null;
  }
}

function fetchMedia(birdName: string, mode: string): Promise<InatMedia | null> {
  return mode === 'sound' ? fetchInatSound(birdName) : fetchInatPhoto(birdName);
}

function buildResponse(answer: BirdBasic, media: InatMedia, pool: BirdBasic[]) {
  const distractors = shuffle(pool.filter(b => b.id !== answer.id && isIdentifiable(b.name))).slice(0, 4);
  const choices = shuffle([answer.name, ...distractors.map(d => d.name)]);
  return Response.json({ media, choices, answer: answer.name, category: answer.category });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const birdId = sp.get('birdId');
  const category = sp.get('category');
  const mode = sp.get('mode') ?? 'photo';
  const categoryArg = category && category !== 'All' ? category : null;

  const pool = await getBirdsByCategory(categoryArg);

  if (birdId) {
    const bird = pool.find(b => b.id === Number(birdId));
    if (!bird) return Response.json({ error: 'Bird not found' }, { status: 404 });

    const media = await fetchMedia(bird.name, mode);
    if (!media) return Response.json({ error: `No ${mode} found` }, { status: 404 });

    return buildResponse(bird, media, pool);
  }

  // Random mode
  const candidates = pool.filter(b => isIdentifiable(b.name));
  if (candidates.length === 0) {
    return Response.json({ error: 'No identifiable birds in this category' }, { status: 400 });
  }

  for (const candidate of shuffle(candidates).slice(0, 5)) {
    const media = await fetchMedia(candidate.name, mode);
    if (media) return buildResponse(candidate, media, pool);
  }

  return Response.json({ error: 'Could not find media for this category. Try another.' }, { status: 502 });
}
