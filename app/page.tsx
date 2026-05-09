export const dynamic = 'force-dynamic';

import { getUserByUsername, getAllUserBirds, getUserFriends } from '@/lib/db';
import BirddexClient from './components/BirddexClient';

export default async function Home() {
  const isaak = await getUserByUsername('isaak');
  const [birds, friends] = isaak
    ? await Promise.all([getAllUserBirds(isaak.id, isaak.region), getUserFriends(isaak.id)])
    : [[], []];
  return (
    <BirddexClient
      initialBirds={birds}
      username="isaak"
      region={isaak?.region ?? 'BC'}
      allUsers={friends}
    />
  );
}
