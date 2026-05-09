import { getUserByUsername, getUserFriends, removeFriend } from '@/lib/db';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ username: string; friendUsername: string }> }
) {
  const { username, friendUsername } = await params;
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
