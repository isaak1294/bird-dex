import { createUser, getUserByUsername } from '@/lib/db';
import { signToken, makeTokenCookie } from '@/lib/auth';

export async function POST(req: Request) {
  const { username, region, password } = await req.json() as { username: string; region: string; password: string };
  if (!username?.trim()) return Response.json({ error: 'Username required' }, { status: 400 });
  if (!password?.trim()) return Response.json({ error: 'Password required' }, { status: 400 });

  const existing = await getUserByUsername(username.trim());
  if (existing) return Response.json({ error: 'Username taken' }, { status: 409 });

  const user = await createUser(username.trim(), region ?? 'BC', password.trim());
  const token = await signToken(user.id, user.username);
  return new Response(JSON.stringify({ user, token }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeTokenCookie(token),
    },
  });
}
