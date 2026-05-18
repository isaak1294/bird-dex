import { getUserByUsername, getUserFriends, removeFriend } from '@/lib/db';
import { requireOwnership } from '@/lib/auth';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ username: string; friendUsername: string }> }
) {
  const { username, friendUsername } = await params;
  if (!(await requireOwnership(req, username))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const [user, friend] = await Promise.all([
    getUserByUsername(username),
    getUserByUsername(friendUsername),
  ]);
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!friend) return Response.json({ error: 'Friend not found' }, { status: 404 });
  await removeFriend(user.id, friend.id);
  const friends = await getUserFriends(user.id);
  return Response.json(friends);
}
