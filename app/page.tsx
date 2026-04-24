export const dynamic = 'force-dynamic';

import { getAllBirds } from '@/lib/db';
import BirddexClient from './components/BirddexClient';

export default async function Home() {
  const birds = await getAllBirds();
  return <BirddexClient initialBirds={birds} />;
}
