import { createUser, getUserByUsername } from '@/lib/db';

export async function POST(req: Request) {
  const { username, region } = await req.json() as { username: string; region: string };
  if (!username?.trim()) return Response.json({ error: 'Username required' }, { status: 400 });

  const existing = await getUserByUsername(username.trim());
  if (existing) return Response.json({ error: 'Username taken' }, { status: 409 });

  const user = await createUser(username.trim(), region ?? 'BC');
  return Response.json(user, { status: 201 });
}
