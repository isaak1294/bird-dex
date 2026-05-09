import { getUserByUsername, getUserFriends, addFriend } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });
  const friends = await getUserFriends(user.id);
  return Response.json(friends);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { friendUsername } = await req.json() as { friendUsername: string };
  const [user, friend] = await Promise.all([
    getUserByUsername(username),
    getUserByUsername(friendUsername?.trim()),
  ]);
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!friend) return Response.json({ error: 'User not found' }, { status: 404 });
  if (friend.id === user.id) return Response.json({ error: "Can't friend yourself" }, { status: 400 });
  await addFriend(user.id, friend.id);
  const friends = await getUserFriends(user.id);
  return Response.json(friends);
}
