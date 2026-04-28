import type { NextRequest } from 'next/server';
import { getBirdsByCategory } from '@/lib/db';

function isIdentifiable(name: string): boolean {
  return !/(hybrid|\bx\s|\bsp\.|\bsp$|\/)/i.test(name);
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const category = sp.get('category');
  const rarities = sp.getAll('rarity');

  const categoryArg = category && category !== 'All' ? category : null;
  const birds = await getBirdsByCategory(categoryArg, rarities.length > 0 ? rarities : undefined);
  const identifiable = birds.filter(b => isIdentifiable(b.name));

  return Response.json(
    identifiable.map(b => ({ id: b.id, name: b.name, category: b.category }))
  );
}
