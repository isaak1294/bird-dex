import { validateUser } from '@/lib/db';
import { signToken, makeTokenCookie } from '@/lib/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { password } = await req.json() as { password: string };
  if (!password) return Response.json({ error: 'Password required' }, { status: 400 });

  const user = await validateUser(username, password);
  if (!user) return Response.json({ error: 'Wrong password' }, { status: 401 });

  const token = await signToken(user.id, user.username);
  return new Response(JSON.stringify({ user, token }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeTokenCookie(token),
    },
  });
}
