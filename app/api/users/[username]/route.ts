import { getUserByUsername, updateUserRegion } from '@/lib/db';
import { requireOwnership } from '@/lib/auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(user);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  if (!(await requireOwnership(req, username))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { region } = await req.json() as { region: string };
  const allowed = ['BC', 'SK'];
  if (!allowed.includes(region)) return Response.json({ error: 'Invalid region' }, { status: 400 });
  const user = await updateUserRegion(username, region);
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(user);
}
