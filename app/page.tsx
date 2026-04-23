import { getAllBirds, getCategories } from '@/lib/db';
import BirddexClient from './components/BirddexClient';

export default async function Home() {
  const [birds, categories] = await Promise.all([getAllBirds(), getCategories()]);
  const totalDiscovered = birds.filter(b => b.discovered).length;

  return (
    <BirddexClient
      initialBirds={birds}
      categories={categories}
      totalDiscovered={totalDiscovered}
    />
  );
}
