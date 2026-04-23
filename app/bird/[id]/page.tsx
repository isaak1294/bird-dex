import { getBirdById, getAllBirds } from '@/lib/db';
import { notFound } from 'next/navigation';
import BirdDetail from './BirdDetail';

export default async function BirdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bird, allBirds] = await Promise.all([
    getBirdById(Number(id)),
    getAllBirds(),
  ]);
  if (!bird) notFound();

  const currentIdx = allBirds.findIndex(b => b.id === bird.id);
  const prevBird = currentIdx > 0 ? allBirds[currentIdx - 1] : null;
  const nextBird = currentIdx < allBirds.length - 1 ? allBirds[currentIdx + 1] : null;

  return (
    <BirdDetail
      bird={bird}
      prevId={prevBird?.id ?? null}
      nextId={nextBird?.id ?? null}
    />
  );
}
