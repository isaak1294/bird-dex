import { getUserByUsername } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(user);
}
