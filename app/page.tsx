export const dynamic = 'force-dynamic';

import { getUserByUsername, getAllUserBirds, getAllUsers } from '@/lib/db';
import BirddexClient from './components/BirddexClient';

export default async function Home() {
  const [isaak, allUsers] = await Promise.all([getUserByUsername('isaak'), getAllUsers()]);
  const birds = isaak ? await getAllUserBirds(isaak.id) : [];
  return (
    <BirddexClient
      initialBirds={birds}
      username="isaak"
      region={isaak?.region ?? 'BC'}
      allUsers={allUsers}
    />
  );
}
