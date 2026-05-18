import { getUserByUsername, getAllUserBirds } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });
  const birds = await getAllUserBirds(user.id, user.region);
  return Response.json(birds);
}
