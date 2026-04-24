export const dynamic = 'force-dynamic';

import { getUserByUsername, getAllUserBirds, getUserBirdById } from '@/lib/db';
import { notFound } from 'next/navigation';
import BirdDetail from './BirdDetail';

export default async function UserBirdPage({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}) {
  const { username, id } = await params;
  const user = await getUserByUsername(username);
  if (!user) notFound();

  const [bird, allBirds] = await Promise.all([
    getUserBirdById(user.id, Number(id)),
    getAllUserBirds(user.id),
  ]);
  if (!bird) notFound();

  const currentIdx = allBirds.findIndex(b => b.id === bird.id);
  const prevBird = currentIdx > 0 ? allBirds[currentIdx - 1] : null;
  const nextBird = currentIdx < allBirds.length - 1 ? allBirds[currentIdx + 1] : null;

  return (
    <BirdDetail
      bird={bird}
      username={user.username}
      region={user.region}
      prevId={prevBird?.id ?? null}
      nextId={nextBird?.id ?? null}
    />
  );
}
