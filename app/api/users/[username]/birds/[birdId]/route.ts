import { getUserByUsername, getUserBirdById, updateUserBird } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string; birdId: string }> }
) {
  const { username, birdId } = await params;
  const user = await getUserByUsername(username);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
  const bird = await getUserBirdById(user.id, Number(birdId));
  if (!bird) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(bird);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ username: string; birdId: string }> }
) {
  const { username, birdId } = await params;
  const user = await getUserByUsername(username);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
  const body = await req.json() as { discovered?: 0 | 1; field_notes?: string; cover_photo_id?: number | null };
  await updateUserBird(user.id, Number(birdId), body);
  const bird = await getUserBirdById(user.id, Number(birdId));
  return Response.json(bird);
}
