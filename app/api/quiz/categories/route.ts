import { getDistinctBirdCategories } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await getDistinctBirdCategories();
  return Response.json(categories);
}
