import { getAllBirds } from '@/lib/db';

export async function GET() {
  const birds = await getAllBirds();
  return Response.json(birds);
}
