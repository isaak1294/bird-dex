import { validateUser } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { password } = await req.json() as { password: string };
  if (!password) return Response.json({ error: 'Password required' }, { status: 400 });
  const user = await validateUser(username, password);
  if (!user) return Response.json({ error: 'Wrong password' }, { status: 401 });
  return Response.json(user);
}
