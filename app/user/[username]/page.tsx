export const dynamic = 'force-dynamic';

import { getUserByUsername, getAllUserBirds, getUserFriends } from '@/lib/db';
import { notFound } from 'next/navigation';
import BirddexClient from '@/app/components/BirddexClient';

export default async function UserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) notFound();

  const [birds, friends] = await Promise.all([
    getAllUserBirds(user.id, user.region),
    getUserFriends(user.id),
  ]);
  return (
    <BirddexClient
      initialBirds={birds}
      username={user.username}
      region={user.region}
      allUsers={friends}
    />
  );
}
