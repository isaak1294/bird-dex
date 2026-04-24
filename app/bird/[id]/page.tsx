import { redirect } from 'next/navigation';

export default async function OldBirdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/user/isaak/bird/${id}`);
}
